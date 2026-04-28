import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, BackHandler, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';

const TIPIFICACOES = ['Deslizamento', 'Tempestade', 'Incêndio', 'Alagamento', 'Outros'];
const NIVEIS_RISCO = ['Baixo', 'Médio', 'Alto', 'Muito Alto'];
const TIPOS_IMOVEL = ['Residencial', 'Comercial', 'Misto'];
const MATERIAIS = ['Alvenaria', 'Madeira', 'Mista', 'Metálica', 'Outros'];
const PROPRIEDADES = ['Própria', 'Cedida', 'Alugada'];
const TIPOS_ESTRUTURA = ['Alvenaria', 'Madeira', 'Mista', 'Metálica', 'Outros'];
const RISCOS_ESTRUT = ['Nenhum', 'Baixo', 'Médio', 'Alto', 'Crítico'];
const SITUACOES_IMOVEL = ['Interditado', 'Parcial', 'Liberado'];
const ORGAOS = ['SEMDCEP', 'SEMIO', 'CBMAM', 'SEMMA', 'SEMASC', 'Outros'];

const NIVEL_CORES: Record<string, string> = {
  'Baixo': Colors.success,
  'Médio': Colors.warning,
  'Alto': '#E07B00',
  'Muito Alto': Colors.danger,
};

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}
function Input({ value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return <TextInput style={[styles.input, multiline && { height: 100, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textSecondary} keyboardType={keyboardType || 'default'} multiline={multiline} />;
}
function BtnGroup({ options, value, onChange, colorMap }: { options: string[]; value: string; onChange: (v: string) => void; colorMap?: Record<string, string> }) {
  return (
    <View style={styles.btnGroup}>
      {options.map(opt => {
        const isSelected = value === opt;
        const selColor = colorMap?.[opt] || Colors.primary;
        return (
          <TouchableOpacity key={opt} style={[styles.btnOpt, isSelected && { backgroundColor: selColor, borderColor: selColor }]} onPress={() => { Keyboard.dismiss(); onChange(opt); }}>
            <Text style={[styles.btnOptText, isSelected && styles.btnOptTextSel]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
function SimNao({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.simNaoRow}>
      <TouchableOpacity style={[styles.simNaoBtn, value === true && styles.simNaoBtnSim]} onPress={() => { Keyboard.dismiss(); onChange(true); }}>
        <Text style={[styles.simNaoText, value === true && styles.simNaoTextSel]}>Sim</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.simNaoBtn, value === false && styles.simNaoBtnNao]} onPress={() => { Keyboard.dismiss(); onChange(false); }}>
        <Text style={[styles.simNaoText, value === false && styles.simNaoTextSel]}>Não</Text>
      </TouchableOpacity>
    </View>
  );
}
function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => { Keyboard.dismiss(); onToggle(); }}>
      <View style={[styles.checkBox, checked && styles.checkBoxSel]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function applyCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function applyPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

const FORM_INICIAL = {
  nome_solicitante: '', cpf: '', rg: '', telefone: '', email: '',
  endereco: '', bairro: '', municipio: '', ponto_referencia: '',
  protocolo: '', gps_lat: null as number | null, gps_lng: null as number | null,
  tipificacao: '', nivel_risco: '', localizacao: '', tipo_imovel: '',
  material_construcao: '', propriedade: '',
  desabrigados: '0', desalojados: '0', pessoas_afetadas: '0', familias_afetadas: '0',
  danos_materiais: '', endereco_ocorrencia: '', descricao_situacao: '', recomendacoes: '',
  tipo_estrutura: '', risco_estrutural: '', risco_hidrologico: '',
  orgao_destino: [] as string[], situacao_imovel: '', reavaliacao: null as boolean | null,
  nome_vistoriador: '', matricula: '',
  qual_tipificacao_outro: '', qual_material_outro: '', qual_estrutura_outro: '',
  qual_orgao_outro: '', obs_risco_estrutural: '', obs_risco_hidrologico: '',
};

export default function NovaVistoria() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = !!id;
  const rascunhoId = useRef<string | null>(id || null);
  const autoSaveTimer = useRef<any>(null);
  const [form, setForm] = useState({ ...FORM_INICIAL });

  useEffect(() => {
    if (!id) return;
    const carregarRegistro = async () => {
      try {
        const col = database.collections.get('vistorias');
        const registro = await col.find(id as string);
        const raw = registro._raw;
        const b = (v: any) => v === 1 ? true : v === 0 ? false : null;
        setForm({
          nome_solicitante: raw.nome_solicitante || '',
          cpf: raw.cpf || '', rg: raw.rg || '', telefone: raw.telefone || '',
          email: raw.email || '', endereco: raw.endereco || '',
          bairro: raw.bairro || '', municipio: raw.municipio || '',
          ponto_referencia: raw.ponto_referencia || '', protocolo: raw.protocolo || '',
          gps_lat: raw.gps_lat || null, gps_lng: raw.gps_lng || null,
          tipificacao: raw.tipificacao || '', nivel_risco: raw.nivel_risco || '',
          localizacao: raw.localizacao || '', tipo_imovel: raw.tipo_imovel || '',
          material_construcao: raw.material_construcao || '', propriedade: raw.propriedade || '',
          desabrigados: String(raw.desabrigados || 0), desalojados: String(raw.desalojados || 0),
          pessoas_afetadas: String(raw.pessoas_afetadas || 0), familias_afetadas: String(raw.familias_afetadas || 0),
          danos_materiais: raw.danos_materiais || '', endereco_ocorrencia: raw.endereco_ocorrencia || '',
          descricao_situacao: raw.descricao_situacao || '', recomendacoes: raw.recomendacoes || '',
          tipo_estrutura: raw.tipo_estrutura || '', risco_estrutural: raw.risco_estrutural || '',
          risco_hidrologico: raw.risco_hidrologico || '',
          orgao_destino: raw.orgao_destino ? JSON.parse(raw.orgao_destino) : [],
          situacao_imovel: raw.situacao_imovel || '', reavaliacao: b(raw.reavaliacao),
          nome_vistoriador: raw.nome_vistoriador || '', matricula: raw.matricula || '',
          qual_tipificacao_outro: raw.qual_tipificacao_outro || '',
          qual_material_outro: raw.qual_material_outro || '',
          qual_estrutura_outro: raw.qual_estrutura_outro || '',
          qual_orgao_outro: raw.qual_orgao_outro || '',
          obs_risco_estrutural: raw.obs_risco_estrutural || '',
          obs_risco_hidrologico: raw.obs_risco_hidrologico || '',
        });
        rascunhoId.current = id as string;
      } catch (e) {
        console.error('Erro ao carregar:', e);
        router.back();
      }
    };
    carregarRegistro();
  }, [id]);

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  }
  function toggleOrgao(orgao: string) {
    setForm(prev => {
      const lista = prev.orgao_destino.includes(orgao)
        ? prev.orgao_destino.filter(o => o !== orgao)
        : [...prev.orgao_destino, orgao];
      return { ...prev, orgao_destino: lista };
    });
    scheduleAutoSave();
  }
  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => salvarRascunho(), 2000);
  }
  async function salvarRascunho() {
    if (!form.nome_solicitante && !form.cpf) return;
    try {
      await database.write(async () => {
        const col = database.collections.get('vistorias');
        const data = { ...form, orgao_destino: JSON.stringify(form.orgao_destino), desabrigados: parseInt(form.desabrigados) || 0, desalojados: parseInt(form.desalojados) || 0, pessoas_afetadas: parseInt(form.pessoas_afetadas) || 0, familias_afetadas: parseInt(form.familias_afetadas) || 0, rascunho: true, sincronizado: false, updated_at: Date.now() };
        if (rascunhoId.current) {
          const rec = await col.find(rascunhoId.current);
          await rec.update((r: any) => { Object.assign(r._raw, data); });
        } else {
          const rec = await col.create((r: any) => { Object.assign(r._raw, { ...data, created_at: Date.now() }); });
          rascunhoId.current = rec.id;
        }
      });
    } catch (e) { console.log('autoSave', e); }
  }
  async function salvar() {
    if (!form.nome_solicitante.trim()) { Alert.alert('Atenção', 'Nome do solicitante é obrigatório.'); return; }
    if (!form.descricao_situacao.trim()) { Alert.alert('Atenção', 'Descrição da situação é obrigatória.'); return; }
    try {
      await database.write(async () => {
        const col = database.collections.get('vistorias');
        const data = { ...form, orgao_destino: JSON.stringify(form.orgao_destino), desabrigados: parseInt(form.desabrigados) || 0, desalojados: parseInt(form.desalojados) || 0, pessoas_afetadas: parseInt(form.pessoas_afetadas) || 0, familias_afetadas: parseInt(form.familias_afetadas) || 0, rascunho: false, sincronizado: false, updated_at: Date.now() };
        if (rascunhoId.current) {
          const rec = await col.find(rascunhoId.current);
          await rec.update((r: any) => {
            r.nome_solicitante = form.nome_solicitante;
            r.cpf = form.cpf;
            r.rg = form.rg;
            r.telefone = form.telefone;
            r.email = form.email;
            r.endereco = form.endereco;
            r.bairro = form.bairro;
            r.municipio = form.municipio;
            r.ponto_referencia = form.ponto_referencia;
            r.protocolo = form.protocolo;
            r.gps_lat = form.gps_lat;
            r.gps_lng = form.gps_lng;
            r.tipificacao = form.tipificacao;
            r.qual_tipificacao_outro = form.qual_tipificacao_outro;
            r.nivel_risco = form.nivel_risco;
            r.localizacao = form.localizacao;
            r.tipo_imovel = form.tipo_imovel;
            r.material_construcao = form.material_construcao;
            r.qual_material_outro = form.qual_material_outro;
            r.propriedade = form.propriedade;
            r.desabrigados = parseInt(form.desabrigados) || 0;
            r.desalojados = parseInt(form.desalojados) || 0;
            r.pessoas_afetadas = parseInt(form.pessoas_afetadas) || 0;
            r.familias_afetadas = parseInt(form.familias_afetadas) || 0;
            r.danos_materiais = form.danos_materiais;
            r.endereco_ocorrencia = form.endereco_ocorrencia;
            r.descricao_situacao = form.descricao_situacao;
            r.recomendacoes = form.recomendacoes;
            r.tipo_estrutura = form.tipo_estrutura;
            r.qual_estrutura_outro = form.qual_estrutura_outro;
            r.risco_estrutural = form.risco_estrutural;
            r.obs_risco_estrutural = form.obs_risco_estrutural;
            r.risco_hidrologico = form.risco_hidrologico;
            r.obs_risco_hidrologico = form.obs_risco_hidrologico;
            r.orgao_destino = JSON.stringify(form.orgao_destino);
            r.qual_orgao_outro = form.qual_orgao_outro;
            r.situacao_imovel = form.situacao_imovel;
            r.reavaliacao = form.reavaliacao;
            r.nome_vistoriador = form.nome_vistoriador;
            r.matricula = form.matricula;
            r.rascunho = false;
            r.sincronizado = false;
            r.updated_at = Date.now();
          });
        } else {
          await col.create((r: any) => { Object.assign(r._raw, { ...data, created_at: Date.now() }); });
        }
      });
      Alert.alert('Sucesso', 'Vistoria salva!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) { console.error('Erro ao salvar:', e); Alert.alert('Erro', 'Não foi possível salvar.'); }
  }
  async function capturaGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permissão negada', 'Habilite a localização.'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    set('gps_lat', loc.coords.latitude);
    set('gps_lng', loc.coords.longitude);
    Alert.alert('GPS capturado', `Lat: ${loc.coords.latitude.toFixed(6)}\nLng: ${loc.coords.longitude.toFixed(6)}`);
  }
  useEffect(() => {
    const b = BackHandler.addEventListener('hardwareBackPress', () => {
      if (form.nome_solicitante) {
        Alert.alert('Sair?', 'O rascunho foi salvo automaticamente.', [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Sair', onPress: () => router.back() },
        ]);
        return true;
      }
      return false;
    });
    return () => b.remove();
  }, [form.nome_solicitante]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
          <Text style={styles.topTitle}>{editando ? 'Editar Vistoria' : 'Nova Vistoria'}</Text>
          <Text style={styles.autoSaveHint}>● Rascunho automático</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📋 Dados do Solicitante" />
          <Field label="Nome Completo *"><Input value={form.nome_solicitante} onChangeText={(v: string) => set('nome_solicitante', v)} placeholder="Nome completo do solicitante" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="CPF *"><Input value={form.cpf} onChangeText={(v: string) => set('cpf', applyCPF(v))} placeholder="000.000.000-00" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="RG"><Input value={form.rg} onChangeText={(v: string) => set('rg', v)} placeholder="0000000-0" /></Field></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Telefone"><Input value={form.telefone} onChangeText={(v: string) => set('telefone', applyPhone(v))} placeholder="(00) 00000-0000" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="E-mail"><Input value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@exemplo.com" keyboardType="email-address" /></Field></View>
          </View>
          <Field label="Endereço Completo *"><Input value={form.endereco} onChangeText={(v: string) => set('endereco', v)} placeholder="Rua, número, complemento" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Bairro/Comunidade"><Input value={form.bairro} onChangeText={(v: string) => set('bairro', v)} placeholder="Bairro" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Município/UF"><Input value={form.municipio} onChangeText={(v: string) => set('municipio', v)} placeholder="Tefé/AM" /></Field></View>
          </View>
          <Field label="Ponto de Referência"><Input value={form.ponto_referencia} onChangeText={(v: string) => set('ponto_referencia', v)} placeholder="Próximo a..." /></Field>
          <Field label="Protocolo (opcional)"><Input value={form.protocolo} onChangeText={(v: string) => set('protocolo', v)} placeholder="Ex: 001/2026" /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🔍 Dados da Vistoria" />
          <TouchableOpacity style={styles.gpsBtn} onPress={capturaGPS}>
            <Text style={styles.gpsBtnText}>📍 {form.gps_lat ? `GPS: ${form.gps_lat.toFixed(4)}, ${form.gps_lng?.toFixed(4)}` : 'Capturar GPS (opcional)'}</Text>
          </TouchableOpacity>
          <Field label="Tipificação *">
            <BtnGroup options={TIPIFICACOES} value={form.tipificacao} onChange={(v) => set('tipificacao', v)} />
          </Field>
          {form.tipificacao === 'Outros' && (
            <Field label="Qual tipificação?">
              <Input value={form.qual_tipificacao_outro} onChangeText={(v: string) => set('qual_tipificacao_outro', v)} placeholder="Descreva o tipo de ocorrência" />
            </Field>
          )}
          <Field label="Nível de Risco">
            <BtnGroup options={NIVEIS_RISCO} value={form.nivel_risco} onChange={(v) => set('nivel_risco', v)} colorMap={NIVEL_CORES} />
          </Field>
          <Field label="Localização">
            <BtnGroup options={['Urbana', 'Rural']} value={form.localizacao} onChange={(v) => set('localizacao', v)} />
          </Field>
          <Field label="Tipo de Imóvel">
            <BtnGroup options={TIPOS_IMOVEL} value={form.tipo_imovel} onChange={(v) => set('tipo_imovel', v)} />
          </Field>
          <Field label="Material de Construção">
            <BtnGroup options={MATERIAIS} value={form.material_construcao} onChange={(v) => set('material_construcao', v)} />
          </Field>
          {form.material_construcao === 'Outros' && (
            <Field label="Qual material?">
              <Input value={form.qual_material_outro} onChangeText={(v: string) => set('qual_material_outro', v)} placeholder="Descreva o material" />
            </Field>
          )}
          <Field label="Propriedade">
            <BtnGroup options={PROPRIEDADES} value={form.propriedade} onChange={(v) => set('propriedade', v)} />
          </Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="⚠️ Danos Humanos e Materiais" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Desabrigados"><Input value={form.desabrigados} onChangeText={(v: string) => set('desabrigados', v)} keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Desalojados"><Input value={form.desalojados} onChangeText={(v: string) => set('desalojados', v)} keyboardType="numeric" /></Field></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Pessoas Afetadas"><Input value={form.pessoas_afetadas} onChangeText={(v: string) => set('pessoas_afetadas', v)} keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Famílias Afetadas"><Input value={form.familias_afetadas} onChangeText={(v: string) => set('familias_afetadas', v)} keyboardType="numeric" /></Field></View>
          </View>
          <Field label="Danos Materiais"><Input value={form.danos_materiais} onChangeText={(v: string) => set('danos_materiais', v)} placeholder="Descreva os danos materiais observados" multiline /></Field>
          <Field label="Endereço da Ocorrência (se diferente)"><Input value={form.endereco_ocorrencia} onChangeText={(v: string) => set('endereco_ocorrencia', v)} placeholder="Se diferente do endereço do solicitante" /></Field>
          <Field label="Descrição da Situação *"><Input value={form.descricao_situacao} onChangeText={(v: string) => set('descricao_situacao', v)} placeholder="Descreva detalhadamente a situação encontrada" multiline /></Field>
          <Field label="Recomendações"><Input value={form.recomendacoes} onChangeText={(v: string) => set('recomendacoes', v)} placeholder="Medidas recomendadas para mitigação" multiline /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🏠 Tipo de Estrutura e Riscos" />
          <Field label="Tipo de Estrutura">
            <BtnGroup options={TIPOS_ESTRUTURA} value={form.tipo_estrutura} onChange={(v) => set('tipo_estrutura', v)} />
          </Field>
          {form.tipo_estrutura === 'Outros' && (
            <Field label="Qual estrutura?">
              <Input value={form.qual_estrutura_outro} onChangeText={(v: string) => set('qual_estrutura_outro', v)} placeholder="Descreva o tipo de estrutura" />
            </Field>
          )}
          <Field label="Risco Estrutural">
            <BtnGroup options={RISCOS_ESTRUT} value={form.risco_estrutural} onChange={(v) => set('risco_estrutural', v)} />
          </Field>
          {form.risco_estrutural && form.risco_estrutural !== 'Nenhum' && (
            <Field label="Observação sobre risco estrutural">
              <Input value={form.obs_risco_estrutural} onChangeText={(v: string) => set('obs_risco_estrutural', v)} placeholder="Descreva o risco observado" />
            </Field>
          )}
          <Field label="Risco Hidrológico">
            <BtnGroup options={RISCOS_ESTRUT} value={form.risco_hidrologico} onChange={(v) => set('risco_hidrologico', v)} />
          </Field>
          {form.risco_hidrologico && form.risco_hidrologico !== 'Nenhum' && (
            <Field label="Observação sobre risco hidrológico">
              <Input value={form.obs_risco_hidrologico} onChangeText={(v: string) => set('obs_risco_hidrologico', v)} placeholder="Descreva o risco observado" />
            </Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="📄 Encaminhamento" />
          <Field label="Órgão Destino">
            {ORGAOS.map(orgao => (
              <Checkbox key={orgao} label={orgao} checked={form.orgao_destino.includes(orgao)} onToggle={() => toggleOrgao(orgao)} />
            ))}
          </Field>
          {form.orgao_destino.includes('Outros') && (
            <Field label="Qual órgão?">
              <Input value={form.qual_orgao_outro} onChangeText={(v: string) => set('qual_orgao_outro', v)} placeholder="Nome do órgão" />
            </Field>
          )}
          <Field label="Situação do Imóvel">
            <BtnGroup options={SITUACOES_IMOVEL} value={form.situacao_imovel} onChange={(v) => set('situacao_imovel', v)} />
          </Field>
          <Field label="Reavaliação necessária?">
            <SimNao value={form.reavaliacao} onChange={(v) => set('reavaliacao', v)} />
          </Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="👤 Dados do Vistoriador" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nome do Vistoriador"><Input value={form.nome_vistoriador} onChangeText={(v: string) => set('nome_vistoriador', v)} placeholder="Nome do agente" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Matrícula"><Input value={form.matricula} onChangeText={(v: string) => set('matricula', v)} placeholder="DC-0000" /></Field></View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={salvar}>
          <Text style={styles.saveBtnText}>Salvar Vistoria</Text>
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
  row: { flexDirection: 'row', gap: 8 },
  btnGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btnOpt: { backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: Colors.border },
  btnOptText: { color: Colors.textSecondary, fontSize: 12 },
  btnOptTextSel: { color: '#fff', fontWeight: '600' },
  simNaoRow: { flexDirection: 'row', gap: 8 },
  simNaoBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  simNaoBtnSim: { backgroundColor: Colors.success, borderColor: Colors.success },
  simNaoBtnNao: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  simNaoText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  simNaoTextSel: { color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  checkBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkBoxSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkLabel: { color: Colors.textPrimary, fontSize: 14 },
  gpsBtn: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 10 },
  gpsBtnText: { color: Colors.primary, fontSize: 13 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, margin: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  offlineHint: { color: Colors.success, fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
