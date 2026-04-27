import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, BackHandler, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';

const SITUACOES_IMOVEL = ['Interditado', 'Parcial', 'Liberado'];
const ORGAOS = ['SEMDCEP', 'SEMIO', 'CBMAM', 'SEMMA', 'SEMASC', 'Outros'];
const TIPOS_EXTINTOR = ['Pó ABC', 'CO2', 'Água', 'Espuma', 'Outro'];

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}
function Input({ value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return <TextInput style={[styles.input, multiline && { height: 100, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textSecondary} keyboardType={keyboardType || 'default'} multiline={multiline} />;
}
function BtnGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.btnGroup}>
      {options.map(opt => (
        <TouchableOpacity key={opt} style={[styles.btnOpt, value === opt && styles.btnOptSel]} onPress={() => { Keyboard.dismiss(); onChange(opt); }}>
          <Text style={[styles.btnOptText, value === opt && styles.btnOptTextSel]}>{opt}</Text>
        </TouchableOpacity>
      ))}
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

function applyCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
function applyCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function applyPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

const FORM_INICIAL = {
  nome_estabelecimento: '', cnpj: '', nome_responsavel: '', cpf_responsavel: '',
  telefone: '', endereco: '', bairro: '',
  gps_lat: null as number | null, gps_lng: null as number | null,
  tipo_estabelecimento: '', area_total: '', capacidade_pessoas: '',
  possui_extintor: null as boolean | null, qtd_extintores: '',
  tipo_extintor: '', extintor_validade: null as boolean | null,
  extintor_localizacao_ok: null as boolean | null,
  sinalizacao_emergencia: null as boolean | null,
  saida_desobstruida: null as boolean | null,
  qtd_saidas: '', rotas_fuga_ok: null as boolean | null,
  instalacao_irregular: null as boolean | null,
  possui_glp: null as boolean | null,
  glp_armazenamento_ok: null as boolean | null,
  sistema_fixo_incendio: null as boolean | null,
  iluminacao_emergencia: null as boolean | null,
  hidrante_reserva: null as boolean | null,
  planta_baixa: null as boolean | null,
  apto_alvara: null as boolean | null,
  necessita_adequacoes: null as boolean | null,
  observacoes: '', descricao_tecnica: '', protocolo: '',
  orgao_destino: [] as string[],
  situacao_imovel: '', reavaliacao: null as boolean | null,
  nome_vistoriador: '', matricula: '',
  qual_extintor_outro: '', qual_orgao_outro: '', qual_sistema_fixo: '',
  obs_hidrante: '', obs_iluminacao: '', obs_planta_baixa: '',
};

export default function NovaVistoriaTecnica() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = !!id;
  const rascunhoId = useRef<string | null>(id || null);
  const autoSaveTimer = useRef<any>(null);
  const [form, setForm] = useState({ ...FORM_INICIAL });

  useEffect(() => {
    if (!id) return;
    const carregarRegistro = async () => {
      try {
        const col = database.collections.get('vistorias_tecnicas');
        const registro = await col.find(id as string);
        const raw = registro._raw;
        const b = (v: any) => v === 1 ? true : v === 0 ? false : null;
        setForm({
          nome_estabelecimento: raw.nome_estabelecimento || '',
          cnpj: raw.cnpj || '', nome_responsavel: raw.nome_responsavel || '',
          cpf_responsavel: raw.cpf_responsavel || '', telefone: raw.telefone || '',
          endereco: raw.endereco || '', bairro: raw.bairro || '',
          gps_lat: raw.gps_lat || null, gps_lng: raw.gps_lng || null,
          tipo_estabelecimento: raw.tipo_estabelecimento || '',
          area_total: String(raw.area_total || ''), capacidade_pessoas: String(raw.capacidade_pessoas || ''),
          possui_extintor: b(raw.possui_extintor), qtd_extintores: String(raw.qtd_extintores || ''),
          tipo_extintor: raw.tipo_extintor || '', extintor_validade: b(raw.extintor_validade),
          extintor_localizacao_ok: b(raw.extintor_localizacao_ok),
          sinalizacao_emergencia: b(raw.sinalizacao_emergencia),
          saida_desobstruida: b(raw.saida_desobstruida),
          qtd_saidas: String(raw.qtd_saidas || ''), rotas_fuga_ok: b(raw.rotas_fuga_ok),
          instalacao_irregular: b(raw.instalacao_irregular),
          possui_glp: b(raw.possui_glp), glp_armazenamento_ok: b(raw.glp_armazenamento_ok),
          sistema_fixo_incendio: b(raw.sistema_fixo_incendio),
          iluminacao_emergencia: b(raw.iluminacao_emergencia),
          hidrante_reserva: b(raw.hidrante_reserva), planta_baixa: b(raw.planta_baixa),
          apto_alvara: b(raw.apto_alvara), necessita_adequacoes: b(raw.necessita_adequacoes),
          observacoes: raw.observacoes || '', descricao_tecnica: raw.descricao_tecnica || '',
          protocolo: raw.protocolo || '',
          orgao_destino: raw.orgao_destino ? JSON.parse(raw.orgao_destino) : [],
          situacao_imovel: raw.situacao_imovel || '', reavaliacao: b(raw.reavaliacao),
          nome_vistoriador: raw.nome_vistoriador || '', matricula: raw.matricula || '',
          qual_extintor_outro: raw.qual_extintor_outro || '',
          qual_orgao_outro: raw.qual_orgao_outro || '',
          qual_sistema_fixo: raw.qual_sistema_fixo || '',
          obs_hidrante: raw.obs_hidrante || '',
          obs_iluminacao: raw.obs_iluminacao || '',
          obs_planta_baixa: raw.obs_planta_baixa || '',
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
    if (!form.nome_estabelecimento) return;
    try {
      await database.write(async () => {
        const col = database.collections.get('vistorias_tecnicas');
        const data = { ...form, orgao_destino: JSON.stringify(form.orgao_destino), area_total: parseFloat(form.area_total) || 0, capacidade_pessoas: parseInt(form.capacidade_pessoas) || 0, qtd_extintores: parseInt(form.qtd_extintores) || 0, qtd_saidas: parseInt(form.qtd_saidas) || 0, rascunho: true, sincronizado: false, updated_at: Date.now() };
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
    if (!form.nome_estabelecimento.trim()) { Alert.alert('Atenção', 'Nome do estabelecimento é obrigatório.'); return; }
    try {
      await database.write(async () => {
        const col = database.collections.get('vistorias_tecnicas');
        const data = { ...form, orgao_destino: JSON.stringify(form.orgao_destino), area_total: parseFloat(form.area_total) || 0, capacidade_pessoas: parseInt(form.capacidade_pessoas) || 0, qtd_extintores: parseInt(form.qtd_extintores) || 0, qtd_saidas: parseInt(form.qtd_saidas) || 0, rascunho: false, sincronizado: false, updated_at: Date.now() };
        if (rascunhoId.current) {
          const rec = await col.find(rascunhoId.current);
          await rec.update((r: any) => { Object.keys(data).forEach(key => { r._raw[key] = (data as any)[key]; }); });
        } else {
          await col.create((r: any) => { Object.assign(r._raw, { ...data, created_at: Date.now() }); });
        }
      });
      Alert.alert('Sucesso', 'Vistoria Técnica salva!', [{ text: 'OK', onPress: () => router.back() }]);
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
      if (form.nome_estabelecimento) {
        Alert.alert('Sair?', 'O rascunho foi salvo automaticamente.', [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Sair', onPress: () => router.back() },
        ]);
        return true;
      }
      return false;
    });
    return () => b.remove();
  }, [form.nome_estabelecimento]);

  const resultadoBanner = form.apto_alvara === true
    ? { text: '✓ APTO PARA ALVARÁ', color: Colors.success }
    : form.apto_alvara === false
    ? { text: '✗ INAPTO — NECESSITA ADEQUAÇÕES', color: Colors.danger }
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
          <Text style={styles.topTitle}>{editando ? 'Editar Vistoria Técnica' : 'Nova Vistoria Técnica'}</Text>
          <Text style={styles.autoSaveHint}>● Rascunho automático</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🏢 Dados do Estabelecimento" />
          <Field label="Nome do Estabelecimento *"><Input value={form.nome_estabelecimento} onChangeText={(v: string) => set('nome_estabelecimento', v)} placeholder="Razão social ou nome fantasia" /></Field>
          <Field label="CNPJ"><Input value={form.cnpj} onChangeText={(v: string) => set('cnpj', applyCNPJ(v))} placeholder="00.000.000/0000-00" keyboardType="numeric" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nome do Responsável"><Input value={form.nome_responsavel} onChangeText={(v: string) => set('nome_responsavel', v)} placeholder="Nome completo" /></Field></View>
            <View style={{ flex: 1 }}><Field label="CPF do Responsável"><Input value={form.cpf_responsavel} onChangeText={(v: string) => set('cpf_responsavel', applyCPF(v))} placeholder="000.000.000-00" keyboardType="numeric" /></Field></View>
          </View>
          <Field label="Telefone"><Input value={form.telefone} onChangeText={(v: string) => set('telefone', applyPhone(v))} placeholder="(00) 00000-0000" keyboardType="numeric" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Endereço"><Input value={form.endereco} onChangeText={(v: string) => set('endereco', v)} placeholder="Rua, número" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Bairro"><Input value={form.bairro} onChangeText={(v: string) => set('bairro', v)} placeholder="Bairro" /></Field></View>
          </View>
          <TouchableOpacity style={styles.gpsBtn} onPress={capturaGPS}>
            <Text style={styles.gpsBtnText}>📍 {form.gps_lat ? `GPS: ${form.gps_lat.toFixed(4)}, ${form.gps_lng?.toFixed(4)}` : 'Capturar GPS (opcional)'}</Text>
          </TouchableOpacity>
          <Field label="Tipo de Estabelecimento"><Input value={form.tipo_estabelecimento} onChangeText={(v: string) => set('tipo_estabelecimento', v)} placeholder="Ex: Restaurante, Loja, Escritório" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Área Total (m²)"><Input value={form.area_total} onChangeText={(v: string) => set('area_total', v)} placeholder="Ex: 120" keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Capacidade de Pessoas"><Input value={form.capacidade_pessoas} onChangeText={(v: string) => set('capacidade_pessoas', v)} placeholder="Ex: 50" keyboardType="numeric" /></Field></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🧯 Extintores de Incêndio" />
          <Field label="Possui extintor de incêndio?"><SimNao value={form.possui_extintor} onChange={(v) => set('possui_extintor', v)} /></Field>
          {form.possui_extintor === true && (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Field label="Quantidade"><Input value={form.qtd_extintores} onChangeText={(v: string) => set('qtd_extintores', v)} placeholder="Ex: 2" keyboardType="numeric" /></Field></View>
              </View>
              <Field label="Tipo do Extintor"><BtnGroup options={TIPOS_EXTINTOR} value={form.tipo_extintor} onChange={(v) => set('tipo_extintor', v)} /></Field>
              {form.tipo_extintor === 'Outro' && (
                <Field label="Qual tipo de extintor?">
                  <Input value={form.qual_extintor_outro} onChangeText={(v: string) => set('qual_extintor_outro', v)} placeholder="Descreva o tipo" />
                </Field>
              )}
              <Field label="Dentro do prazo de validade?"><SimNao value={form.extintor_validade} onChange={(v) => set('extintor_validade', v)} /></Field>
              <Field label="Localização adequada e acessível?"><SimNao value={form.extintor_localizacao_ok} onChange={(v) => set('extintor_localizacao_ok', v)} /></Field>
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="🚪 Saídas e Sinalização" />
          <Field label="Possui sinalização de emergência?"><SimNao value={form.sinalizacao_emergencia} onChange={(v) => set('sinalizacao_emergencia', v)} /></Field>
          <Field label="Saída de emergência desobstruída?"><SimNao value={form.saida_desobstruida} onChange={(v) => set('saida_desobstruida', v)} /></Field>
          <Field label="Quantidade de saídas de emergência"><Input value={form.qtd_saidas} onChangeText={(v: string) => set('qtd_saidas', v)} placeholder="Ex: 2" keyboardType="numeric" /></Field>
          <Field label="Rotas de fuga e portas adequadas?"><SimNao value={form.rotas_fuga_ok} onChange={(v) => set('rotas_fuga_ok', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="⚡ Instalações Elétricas e GLP" />
          <Field label="Instalação elétrica irregular aparente?"><SimNao value={form.instalacao_irregular} onChange={(v) => set('instalacao_irregular', v)} /></Field>
          <Field label="Possui botijão de GLP (gás)?"><SimNao value={form.possui_glp} onChange={(v) => set('possui_glp', v)} /></Field>
          {form.possui_glp === true && (
            <Field label="GLP armazenado em local ventilado e sinalizado?"><SimNao value={form.glp_armazenamento_ok} onChange={(v) => set('glp_armazenamento_ok', v)} /></Field>
          )}
          <Field label="Possui outro sistema fixo de combate a incêndio (sprinkler, hidrante interno)?"><SimNao value={form.sistema_fixo_incendio} onChange={(v) => set('sistema_fixo_incendio', v)} /></Field>
          {form.sistema_fixo_incendio === true && (
            <Field label="Qual sistema fixo?">
              <Input value={form.qual_sistema_fixo} onChangeText={(v: string) => set('qual_sistema_fixo', v)} placeholder="Ex: sprinkler, hidrante interno, CO2..." />
            </Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="💡 Iluminação de Emergência" />
          <Field label="Possui iluminação de emergência?"><SimNao value={form.iluminacao_emergencia} onChange={(v) => set('iluminacao_emergencia', v)} /></Field>
          {form.iluminacao_emergencia === true && (
            <Field label="Observação sobre iluminação">
              <Input value={form.obs_iluminacao} onChangeText={(v: string) => set('obs_iluminacao', v)} placeholder="Ex: só corredor principal, em trâmite..." />
            </Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="💧 Hidrante e Reserva d'Água" />
          <Field label="Possui hidrante ou reserva d'água para combate a incêndio?"><SimNao value={form.hidrante_reserva} onChange={(v) => set('hidrante_reserva', v)} /></Field>
          {form.hidrante_reserva === true && (
            <Field label="Observação sobre hidrante/reserva">
              <Input value={form.obs_hidrante} onChangeText={(v: string) => set('obs_hidrante', v)} placeholder="Ex: caixa d'água, hidrante externo..." />
            </Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="📐 Documentação do Estabelecimento" />
          <Field label="Planta baixa / Croqui disponível?"><SimNao value={form.planta_baixa} onChange={(v) => set('planta_baixa', v)} /></Field>
          {form.planta_baixa === true && (
            <Field label="Observação sobre planta/croqui">
              <Input value={form.obs_planta_baixa} onChangeText={(v: string) => set('obs_planta_baixa', v)} placeholder="Ex: só croqui, em trâmite no CBMAM..." />
            </Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="📋 Resultado da Vistoria" />
          <Field label="Estabelecimento adequado para emissão de alvará?">
            <SimNao value={form.apto_alvara} onChange={(v) => set('apto_alvara', v)} />
          </Field>
          {resultadoBanner && (
            <View style={[styles.resultBanner, { borderColor: resultadoBanner.color, backgroundColor: resultadoBanner.color + '20' }]}>
              <Text style={[styles.resultBannerText, { color: resultadoBanner.color }]}>{resultadoBanner.text}</Text>
            </View>
          )}
          {form.apto_alvara === false && (
            <Field label="Necessita adequações antes do alvará?"><SimNao value={form.necessita_adequacoes} onChange={(v) => set('necessita_adequacoes', v)} /></Field>
          )}
          <Field label="Observações"><Input value={form.observacoes} onChangeText={(v: string) => set('observacoes', v)} placeholder="Observações gerais sobre a vistoria" multiline /></Field>
          <Field label="Descrição Técnica"><Input value={form.descricao_tecnica} onChangeText={(v: string) => set('descricao_tecnica', v)} placeholder="Descrição técnica detalhada" multiline /></Field>
          <Field label="Protocolo (opcional)"><Input value={form.protocolo} onChangeText={(v: string) => set('protocolo', v)} placeholder="Ex: VT-2026-001" /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📄 Órgão Destino" />
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
          <Field label="Situação do Imóvel"><BtnGroup options={SITUACOES_IMOVEL} value={form.situacao_imovel} onChange={(v) => set('situacao_imovel', v)} /></Field>
          <Field label="Reavaliação necessária?"><SimNao value={form.reavaliacao} onChange={(v) => set('reavaliacao', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="👤 Dados do Vistoriador" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nome do Vistoriador"><Input value={form.nome_vistoriador} onChangeText={(v: string) => set('nome_vistoriador', v)} placeholder="Nome do agente" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Matrícula"><Input value={form.matricula} onChangeText={(v: string) => set('matricula', v)} placeholder="DC-0000" /></Field></View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={salvar}>
          <Text style={styles.saveBtnText}>Salvar Vistoria Técnica</Text>
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
  topTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  autoSaveHint: { color: Colors.success, fontSize: 11 },
  section: { backgroundColor: Colors.surface, borderRadius: 12, margin: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, color: Colors.textPrimary, fontSize: 13, borderWidth: 0.5, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: 8 },
  btnGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btnOpt: { backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: Colors.border },
  btnOptSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
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
  resultBanner: { borderWidth: 1.5, borderRadius: 10, padding: 14, alignItems: 'center', marginVertical: 10 },
  resultBannerText: { fontSize: 14, fontWeight: 'bold' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, margin: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  offlineHint: { color: Colors.success, fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
