import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';

const GENEROS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'];
const ESCOLARIDADES = ['Sem escolaridade', 'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo'];
const RENDAS = ['Sem renda', 'Até 1 salário', '1 a 2 salários', '2 a 3 salários', 'Acima de 3 salários'];
const TIPOS_MORADIA = ['Própria', 'Alugada', 'Cedida', 'Irregular', 'Abrigo'];
const MATERIAIS = ['Alvenaria', 'Madeira', 'Mista', 'Palha', 'Outro'];
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Emergencial'];

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      keyboardType={keyboardType || 'default'}
    />
  );
}

function BtnGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.btnGroup}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.btnOpt, value === opt && styles.btnOptSel]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.btnOptText, value === opt && styles.btnOptTextSel]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SimNao({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.simNaoRow}>
      <TouchableOpacity style={[styles.simNaoBtn, value === true && styles.simNaoBtnSel]} onPress={() => onChange(true)}>
        <Text style={[styles.simNaoText, value === true && styles.simNaoTextSel]}>Sim</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.simNaoBtn, value === false && styles.simNaoBtnSelNo]} onPress={() => onChange(false)}>
        <Text style={[styles.simNaoText, value === false && styles.simNaoTextSel]}>Não</Text>
      </TouchableOpacity>
    </View>
  );
}

function applyCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function calcIdade(dataNasc: string): number | null {
  const parts = dataNasc.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - y;
  if (hoje.getMonth() < m || (hoje.getMonth() === m && hoje.getDate() < d)) idade--;
  return idade >= 0 ? idade : null;
}

export default function NovoCadastro() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rascunhoId = useRef<string | null>(null);
  const autoSaveTimer = useRef<any>(null);

  const [form, setForm] = useState({
    nome: '', cpf: '', rg: '', data_nascimento: '', genero: '', estado_civil: '',
    nacionalidade: 'Brasileira', naturalidade: '', escolaridade: '', profissao: '',
    telefone: '', email: '', endereco: '', bairro: '', municipio: '', cep: '',
    ponto_referencia: '', gps_lat: null as number | null, gps_lng: null as number | null,
    num_pessoas_familia: '1', responsavel_familiar: null as boolean | null,
    renda_familiar: '', programa_social: '', tempo_mora_local: '', num_comodos: '',
    tipo_moradia: '', material_construcao: '', possui_banheiro: null as boolean | null,
    area_risco: null as boolean | null, afetado_desastre: null as boolean | null,
    ajuda_defesa_civil: null as boolean | null, agua_potavel: null as boolean | null,
    energia_eletrica: null as boolean | null, saneamento_basico: null as boolean | null,
    coleta_lixo: null as boolean | null, deficiencia: null as boolean | null,
    doenca_cronica: null as boolean | null, medicamento_continuo: null as boolean | null,
    documentos_completos: null as boolean | null, assistencia_imediata: null as boolean | null,
    prioridade: '', observacoes: '',
  });

  const idade = calcIdade(form.data_nascimento);

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  }

  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => salvarRascunho(), 2000);
  }

  async function salvarRascunho() {
    if (!form.nome && !form.cpf) return;
    try {
      await database.write(async () => {
        const collection = database.collections.get('cadastros');
        if (rascunhoId.current) {
          const record = await collection.find(rascunhoId.current);
          await record.update((r: any) => { Object.assign(r._raw, { ...form, rascunho: true, sincronizado: false, updated_at: Date.now() }); });
        } else {
          const record = await collection.create((r: any) => { Object.assign(r._raw, { ...form, rascunho: true, sincronizado: false, created_at: Date.now(), updated_at: Date.now() }); });
          rascunhoId.current = record.id;
        }
      });
    } catch (e) { console.log('autoSave error', e); }
  }

  async function salvar() {
    if (!form.nome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    if (!form.cpf.trim()) { Alert.alert('Atenção', 'CPF é obrigatório.'); return; }
    try {
      await database.write(async () => {
        const collection = database.collections.get('cadastros');
        const data = { ...form, num_pessoas_familia: parseInt(form.num_pessoas_familia) || 1, num_comodos: parseInt(form.num_comodos) || 0, idade: idade || 0, rascunho: false, sincronizado: false, updated_at: Date.now() };
        if (rascunhoId.current) {
          const record = await collection.find(rascunhoId.current);
          await record.update((r: any) => { Object.assign(r._raw, data); });
        } else {
          await collection.create((r: any) => { Object.assign(r._raw, { ...data, created_at: Date.now() }); });
        }
      });
      Alert.alert('Sucesso', 'Cadastro salvo com sucesso!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.'); }
  }

  async function capturaGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão negada', 'Habilite a localização nas configurações.'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    set('gps_lat', loc.coords.latitude);
    set('gps_lng', loc.coords.longitude);
    Alert.alert('GPS capturado', `Lat: ${loc.coords.latitude.toFixed(6)}\nLng: ${loc.coords.longitude.toFixed(6)}`);
  }

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (form.nome || form.cpf) {
        Alert.alert('Sair sem salvar?', 'O rascunho foi salvo automaticamente.', [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Sair', onPress: () => router.back() },
        ]);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [form.nome, form.cpf]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
          <Text style={styles.topTitle}>Novo Cadastro</Text>
          <Text style={styles.autoSaveHint}>● Rascunho automático</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title="👤 Dados Pessoais" />
          <Field label="Nome Completo *"><Input value={form.nome} onChangeText={(v: string) => set('nome', v)} placeholder="Nome completo" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="CPF *"><Input value={form.cpf} onChangeText={(v: string) => set('cpf', applyCPF(v))} placeholder="000.000.000-00" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="RG"><Input value={form.rg} onChangeText={(v: string) => set('rg', v)} placeholder="0000000-0" /></Field></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Data de Nascimento"><Input value={form.data_nascimento} onChangeText={(v: string) => set('data_nascimento', v)} placeholder="DD/MM/AAAA" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Idade"><View style={[styles.input, styles.inputDisabled]}><Text style={styles.inputDisabledText}>{idade !== null ? `${idade} anos` : 'Calculada'}</Text></View></Field></View>
          </View>
          <Field label="Gênero"><BtnGroup options={GENEROS} value={form.genero} onChange={(v) => set('genero', v)} /></Field>
          <Field label="Estado Civil"><BtnGroup options={ESTADOS_CIVIS} value={form.estado_civil} onChange={(v) => set('estado_civil', v)} /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nacionalidade"><Input value={form.nacionalidade} onChangeText={(v: string) => set('nacionalidade', v)} placeholder="Brasileira" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Naturalidade"><Input value={form.naturalidade} onChangeText={(v: string) => set('naturalidade', v)} placeholder="Cidade/UF" /></Field></View>
          </View>
          <Field label="Escolaridade"><BtnGroup options={ESCOLARIDADES} value={form.escolaridade} onChange={(v) => set('escolaridade', v)} /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Profissão"><Input value={form.profissao} onChangeText={(v: string) => set('profissao', v)} placeholder="Ocupação" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Telefone"><Input value={form.telefone} onChangeText={(v: string) => set('telefone', applyPhone(v))} placeholder="(00) 00000-0000" keyboardType="numeric" /></Field></View>
          </View>
          <Field label="E-mail"><Input value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@exemplo.com" keyboardType="email-address" /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📍 Endereço" />
          <Field label="Endereço Completo *"><Input value={form.endereco} onChangeText={(v: string) => set('endereco', v)} placeholder="Rua, número, complemento" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Bairro/Comunidade"><Input value={form.bairro} onChangeText={(v: string) => set('bairro', v)} placeholder="Bairro" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Município/UF"><Input value={form.municipio} onChangeText={(v: string) => set('municipio', v)} placeholder="Tefé/AM" /></Field></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="CEP"><Input value={form.cep} onChangeText={(v: string) => set('cep', v)} placeholder="00000-000" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Ponto de Referência"><Input value={form.ponto_referencia} onChangeText={(v: string) => set('ponto_referencia', v)} placeholder="Próximo a..." /></Field></View>
          </View>
          <TouchableOpacity style={styles.gpsBtn} onPress={capturaGPS}>
            <Text style={styles.gpsBtnText}>📍 {form.gps_lat ? `GPS: ${form.gps_lat.toFixed(4)}, ${form.gps_lng?.toFixed(4)}` : 'Capturar GPS (opcional)'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <SectionTitle title="👨‍👩‍👧 Dados da Família" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nº Pessoas na Família *"><Input value={form.num_pessoas_familia} onChangeText={(v: string) => set('num_pessoas_familia', v)} keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Responsável Familiar?"><SimNao value={form.responsavel_familiar} onChange={(v) => set('responsavel_familiar', v)} /></Field></View>
          </View>
          <Field label="Renda Familiar"><BtnGroup options={RENDAS} value={form.renda_familiar} onChange={(v) => set('renda_familiar', v)} /></Field>
          <Field label="Programa Social"><Input value={form.programa_social} onChangeText={(v: string) => set('programa_social', v)} placeholder="Bolsa Família..." /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🏠 Moradia" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Tempo que mora no local"><Input value={form.tempo_mora_local} onChangeText={(v: string) => set('tempo_mora_local', v)} placeholder="Ex: 5 anos" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Nº de Cômodos"><Input value={form.num_comodos} onChangeText={(v: string) => set('num_comodos', v)} keyboardType="numeric" /></Field></View>
          </View>
          <Field label="Tipo de Moradia"><BtnGroup options={TIPOS_MORADIA} value={form.tipo_moradia} onChange={(v) => set('tipo_moradia', v)} /></Field>
          <Field label="Material de Construção"><BtnGroup options={MATERIAIS} value={form.material_construcao} onChange={(v) => set('material_construcao', v)} /></Field>
          <Field label="Possui Banheiro?"><SimNao value={form.possui_banheiro} onChange={(v) => set('possui_banheiro', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="⚠️ Situação de Risco" />
          <Field label="Residência em Área de Risco?"><SimNao value={form.area_risco} onChange={(v) => set('area_risco', v)} /></Field>
          <Field label="Já foi afetado por desastre?"><SimNao value={form.afetado_desastre} onChange={(v) => set('afetado_desastre', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🤝 Assistência" />
          <Field label="Já recebeu ajuda da Defesa Civil?"><SimNao value={form.ajuda_defesa_civil} onChange={(v) => set('ajuda_defesa_civil', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🔌 Infraestrutura" />
          <Field label="Possui Água Potável?"><SimNao value={form.agua_potavel} onChange={(v) => set('agua_potavel', v)} /></Field>
          <Field label="Possui Energia Elétrica?"><SimNao value={form.energia_eletrica} onChange={(v) => set('energia_eletrica', v)} /></Field>
          <Field label="Possui Saneamento Básico?"><SimNao value={form.saneamento_basico} onChange={(v) => set('saneamento_basico', v)} /></Field>
          <Field label="Possui Coleta de Lixo?"><SimNao value={form.coleta_lixo} onChange={(v) => set('coleta_lixo', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🏥 Saúde" />
          <Field label="Possui alguma deficiência?"><SimNao value={form.deficiencia} onChange={(v) => set('deficiencia', v)} /></Field>
          <Field label="Possui doença crônica?"><SimNao value={form.doenca_cronica} onChange={(v) => set('doenca_cronica', v)} /></Field>
          <Field label="Necessita medicamento contínuo?"><SimNao value={form.medicamento_continuo} onChange={(v) => set('medicamento_continuo', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📄 Documentação" />
          <Field label="Possui documentos completos?"><SimNao value={form.documentos_completos} onChange={(v) => set('documentos_completos', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🚨 Assistência Imediata" />
          <Field label="Necessita assistência imediata?"><SimNao value={form.assistencia_imediata} onChange={(v) => set('assistencia_imediata', v)} /></Field>
          {form.assistencia_imediata && (
            <Field label="Prioridade de Atendimento"><BtnGroup options={PRIORIDADES} value={form.prioridade} onChange={(v) => set('prioridade', v)} /></Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="📝 Observações" />
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            value={form.observacoes}
            onChangeText={(v) => set('observacoes', v)}
            placeholder="Observações adicionais sobre a pessoa/família"
            placeholderTextColor={Colors.textSecondary}
            multiline
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={salvar}>
          <Text style={styles.saveBtnText}>Salvar Cadastro</Text>
        </TouchableOpacity>
        <Text style={styles.offlineHint}>✓ Salvo offline · Sincroniza quando houver internet</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 52, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { color: Colors.primary, fontSize: 15 },
  topTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  autoSaveHint: { color: Colors.success, fontSize: 11 },
  section: { backgroundColor: Colors.surface, borderRadius: 12, margin: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, color: Colors.textPrimary, fontSize: 13, borderWidth: 0.5, borderColor: Colors.border },
  inputDisabled: { justifyContent: 'center' },
  inputDisabledText: { color: Colors.textSecondary, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  btnGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btnOpt: { backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: Colors.border },
  btnOptSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnOptText: { color: Colors.textSecondary, fontSize: 12 },
  btnOptTextSel: { color: '#fff', fontWeight: '600' },
  simNaoRow: { flexDirection: 'row', gap: 8 },
  simNaoBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  simNaoBtnSel: { backgroundColor: Colors.success, borderColor: Colors.success },
  simNaoBtnSelNo: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  simNaoText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  simNaoTextSel: { color: '#fff' },
  gpsBtn: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 8 },
  gpsBtnText: { color: Colors.primary, fontSize: 13 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, margin: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  offlineHint: { color: Colors.success, fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
