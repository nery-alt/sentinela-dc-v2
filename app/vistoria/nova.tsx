import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, BackHandler, Keyboard, Modal, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';
import { IconeGps } from '../../components/ui/icone-gps';
import { buscarPessoasSAD, PessoaSAD, FotoAlvara } from '../../lib/sadApi';
import { escolherFotoVistoria, lerFotos, MAX_FOTOS_VISTORIA } from '../../lib/fotosAlvara';
import { lerCoordenadas, faltouSinal, formatar, type Coord } from '../../lib/coordenadas';
import { TIPOS_OCORRENCIA, NIVEIS_RISCO, MEDIDAS, ORGAOS_DESTINO, mostraImovel, lerLista, camposEmBranco } from '../../lib/vistoriaOpcoes';
import { gerarTextoIA } from '../../lib/ia';

const TIPOS_IMOVEL = ['Residencial', 'Comercial', 'Misto', 'Público'];
const MATERIAIS = ['Alvenaria', 'Madeira', 'Mista', 'Metálica', 'Outros'];
const PROPRIEDADES = ['Própria', 'Cedida', 'Alugada'];
const SITUACOES_IMOVEL = ['Interditado', 'Parcial', 'Liberado'];
const ZONAS = ['Urbana', 'Rural / comunidade'];

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
function BtnGerarIA({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.iaBtn} onPress={onPress} disabled={loading}>
      <Text style={styles.iaBtnText}>{loading ? '✨ Gerando…' : '✨ Gerar com IA'}</Text>
    </TouchableOpacity>
  );
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
      <TouchableOpacity style={[styles.simNaoBtn, value === true && styles.simNaoBtnNao]} onPress={() => { Keyboard.dismiss(); onChange(true); }}>
        <Text style={[styles.simNaoText, value === true && styles.simNaoTextSel]}>Sim</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.simNaoBtn, value === false && styles.simNaoBtnSim]} onPress={() => { Keyboard.dismiss(); onChange(false); }}>
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
  // origem da demanda
  origem_tipo: 'pessoa', nome_solicitante: '', cpf: '', telefone: '',
  orgao_demandante: '', documento_origem: '', escopo_pedido: '',
  protocolo: '', sad_pessoa_id: '',
  // local
  localizacao: '', endereco: '', bairro: '', municipio: 'Tefé/AM', ponto_referencia: '',
  gps_lat: null as number | null, gps_lng: null as number | null,
  // ocorrência
  tipificacao: '', qual_tipificacao_outro: '', nivel_risco: '', risco_iminente: null as boolean | null,
  descricao_situacao: '', relatado: '',
  // atingidos
  desabrigados: '0', desalojados: '0', pessoas_afetadas: '0', familias_afetadas: '0',
  // imóvel (só para os tipos em que há imóvel)
  tipo_imovel: '', material_construcao: '', qual_material_outro: '', propriedade: '', situacao_imovel: '',
  // medidas e encaminhamento
  medidas: [] as string[], recomendacoes: '', orgao_destino: [] as string[], qual_orgao_outro: '',
  // fotos e equipe
  fotos: [] as FotoAlvara[],
  nome_vistoriador: '', matricula: '',
  // campos antigos: não aparecem mais na tela, mas são mantidos ao editar uma vistoria antiga
  rg: '', email: '', danos_materiais: '', endereco_ocorrencia: '',
  tipo_estrutura: '', qual_estrutura_outro: '', risco_estrutural: '', obs_risco_estrutural: '',
  risco_hidrologico: '', obs_risco_hidrologico: '', reavaliacao: null as boolean | null,
};

// O que vai para o banco do celular
function paraBanco(f: typeof FORM_INICIAL) {
  return {
    ...f,
    nome_solicitante: f.origem_tipo === 'orgao' ? (f.orgao_demandante.trim() || f.nome_solicitante) : f.nome_solicitante,
    orgao_destino: JSON.stringify(f.orgao_destino),
    medidas: JSON.stringify(f.medidas),
    fotos: JSON.stringify(f.fotos || []),
    reavaliacao: f.medidas.includes('Monitoramento / reavaliação') ? true : f.reavaliacao,
    desabrigados: parseInt(f.desabrigados) || 0, desalojados: parseInt(f.desalojados) || 0,
    pessoas_afetadas: parseInt(f.pessoas_afetadas) || 0, familias_afetadas: parseInt(f.familias_afetadas) || 0,
  };
}

export default function NovaVistoria() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = !!id;
  const rascunhoId = useRef<string | null>(id || null);
  const autoSaveTimer = useRef<any>(null);
  const formRef = useRef<any>(null);
  const [form, setForm] = useState({ ...FORM_INICIAL });
  formRef.current = form;
  const [sadVisible, setSadVisible] = useState(false);
  const [sadQuery, setSadQuery] = useState('');
  const [sadResultados, setSadResultados] = useState<PessoaSAD[] | null>(null);
  const [buscandoSAD, setBuscandoSAD] = useState(false);
  const [gerandoIA, setGerandoIA] = useState<string | null>(null);
  const [coordTexto, setCoordTexto] = useState('');
  const orgao = form.origem_tipo === 'orgao';

  // mostra no campo manual a coordenada atual (do GPS, da foto ou carregada da vistoria)
  useEffect(() => {
    if (form.gps_lat != null && form.gps_lng != null) setCoordTexto(formatar({ lat: form.gps_lat, lng: form.gps_lng }));
  }, [form.gps_lat, form.gps_lng]);

  function usarCoord(c: Coord) {
    setForm(prev => ({ ...prev, gps_lat: c.lat, gps_lng: c.lng }));
    scheduleAutoSave();
  }
  // coordenada digitada à mão
  function confirmarCoordTexto() {
    const t = coordTexto.trim();
    if (!t) { setForm(prev => ({ ...prev, gps_lat: null, gps_lng: null })); scheduleAutoSave(); return; }
    const c = lerCoordenadas(t);
    if (!c) {
      Alert.alert('Coordenada não reconhecida', 'Use, por exemplo:\n-3.355600, -64.707700\nou\n3°21\'20"S 64°42\'27"W');
      return;
    }
    if (faltouSinal(c)) {
      const corrigida = { lat: -c.lat, lng: -c.lng };
      Alert.alert('Faltou o sinal de menos?', `Tefé fica ao sul e a oeste: os dois números são negativos.\n\nUsar ${formatar(corrigida)}?`, [
        { text: 'Manter como digitei', onPress: () => usarCoord(c) },
        { text: 'Corrigir', onPress: () => usarCoord(corrigida) },
      ]);
      return;
    }
    usarCoord(c);
  }

  async function gerarComIA(campo: 'descricao_situacao' | 'recomendacoes') {
    const fatos = String((formRef.current as any)?.[campo] || '').trim();
    if (!fatos) { Alert.alert('Escreva primeiro', 'Anote os pontos em poucas palavras e toque em Gerar com IA.'); return; }
    Keyboard.dismiss();
    setGerandoIA(campo);
    try {
      const tipo = campo === 'recomendacoes' ? 'recomendacoes' : 'descricao_tecnica';
      const texto = await gerarTextoIA(fatos, tipo as any, 'geral');
      if (texto) set(campo, texto);
    } catch (e) {
      Alert.alert('Não foi possível gerar', 'Verifique a internet e tente de novo. Seu texto foi mantido.');
    } finally {
      setGerandoIA(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    const carregarRegistro = async () => {
      try {
        const col = database.collections.get('vistorias');
        const registro = await col.find(id as string);
        const raw = registro._raw as Record<string, any>;
        const b = (v: any) => v === 1 || v === true ? true : v === 0 || v === false ? false : null;
        const t = (v: any) => (v == null ? '' : String(v));
        const novo: any = { ...FORM_INICIAL };
        for (const k of Object.keys(FORM_INICIAL)) if (typeof (FORM_INICIAL as any)[k] === 'string') novo[k] = t(raw[k]);
        // vistorias antigas: o endereço da ocorrência (se diferente) vira o local
        if (raw.endereco_ocorrencia && !raw.origem_tipo) novo.endereco = raw.endereco_ocorrencia;
        Object.assign(novo, {
          origem_tipo: raw.origem_tipo === 'orgao' ? 'orgao' : 'pessoa',
          municipio: raw.municipio || '',
          localizacao: raw.localizacao === 'Rural' ? 'Rural / comunidade' : t(raw.localizacao),
          gps_lat: raw.gps_lat || null, gps_lng: raw.gps_lng || null,
          risco_iminente: b(raw.risco_iminente), reavaliacao: b(raw.reavaliacao),
          desabrigados: String(raw.desabrigados || 0), desalojados: String(raw.desalojados || 0),
          pessoas_afetadas: String(raw.pessoas_afetadas || 0), familias_afetadas: String(raw.familias_afetadas || 0),
          orgao_destino: lerLista(raw.orgao_destino).map(o => (o === 'SEMMA' ? 'SEMMALP' : o)),
          medidas: lerLista(raw.medidas),
          fotos: lerFotos(raw.fotos, MAX_FOTOS_VISTORIA),
        });
        // vistoria antiga sem "constatei": junta os danos materiais que estavam em outro campo
        if (raw.danos_materiais && !String(raw.descricao_situacao || '').includes(raw.danos_materiais)) {
          novo.descricao_situacao = [raw.descricao_situacao, raw.danos_materiais].filter(Boolean).join('\n\n');
          novo.danos_materiais = '';
        }
        setForm(novo);
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
  function alternar(campo: 'orgao_destino' | 'medidas', valor: string) {
    setForm(prev => {
      const lista = prev[campo].includes(valor) ? prev[campo].filter(o => o !== valor) : [...prev[campo], valor];
      return { ...prev, [campo]: lista };
    });
    scheduleAutoSave();
  }
  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => salvarRascunho(), 2000);
  }
  // há algo digitado que valha guardar como rascunho?
  const temConteudo = (f: any) => !!(f?.nome_solicitante || f?.cpf || f?.orgao_demandante || f?.endereco || f?.descricao_situacao || (f?.fotos || []).length);
  async function gravar(f: typeof FORM_INICIAL, rascunho: boolean) {
    await database.write(async () => {
      const col = database.collections.get('vistorias');
      const data = { ...paraBanco(f), rascunho, sincronizado: false, updated_at: Date.now() };
      if (rascunhoId.current) {
        const rec = await col.find(rascunhoId.current);
        await rec.update((r: any) => { Object.assign(r._raw, data); });
      } else {
        const rec = await col.create((r: any) => { Object.assign(r._raw, { ...data, created_at: Date.now() }); });
        rascunhoId.current = rec.id;
      }
    });
  }
  async function salvarRascunho() {
    const f = formRef.current;
    if (!temConteudo(f)) return;
    try { await gravar(f, true); } catch (e) { console.log('autoSave', e); }
  }
  async function salvarDeVez() {
    try {
      await gravar(formRef.current, false);
      Alert.alert('Sucesso', 'Vistoria salva!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) { console.error('Erro ao salvar:', e); Alert.alert('Erro', 'Não foi possível salvar.'); }
  }
  // Nada é obrigatório: só lembra o que ficou em branco
  function salvar() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    Keyboard.dismiss();
    if (!temConteudo(form)) { Alert.alert('Vistoria vazia', 'Preencha pelo menos o local, o solicitante ou o que foi constatado.'); return; }
    const falta = camposEmBranco(form);
    if (!falta.length) { salvarDeVez(); return; }
    Alert.alert('Ficou em branco', '• ' + falta.join('\n• '), [
      { text: 'Voltar e preencher', style: 'cancel' },
      { text: 'Salvar assim mesmo', onPress: salvarDeVez },
    ]);
  }
  async function capturaGPS() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão negada', 'Habilite a localização.'); return; }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]);
      set('gps_lat', loc.coords.latitude);
      set('gps_lng', loc.coords.longitude);
      Alert.alert('GPS capturado', `Lat: ${loc.coords.latitude.toFixed(6)}\nLng: ${loc.coords.longitude.toFixed(6)}`);
    } catch (e: any) {
      console.error('[GPS] erro ao capturar localização:', e);
      const msg = e?.message === 'timeout'
        ? 'O GPS demorou demais para responder. Tente em um local aberto, longe de cobertura densa.'
        : 'Verifique se a localização está ativada no aparelho e tente novamente.';
      Alert.alert('Não foi possível obter o GPS', msg);
    }
  }
  async function adicionarFoto(origem: 'camera' | 'galeria') {
    if ((formRef.current?.fotos || []).length >= MAX_FOTOS_VISTORIA) { Alert.alert('Limite', `O relatório leva no máximo ${MAX_FOTOS_VISTORIA} fotos.`); return; }
    try {
      const r = await escolherFotoVistoria(origem);
      if (!r) return;
      set('fotos', [...(formRef.current?.fotos || []), r.foto].slice(0, MAX_FOTOS_VISTORIA));
      // a foto trouxe coordenada e a vistoria ainda não tem: oferece usar
      if (r.coord && formRef.current?.gps_lat == null) {
        const c = r.coord;
        Alert.alert('Coordenada na foto', `Esta foto tem a localização ${formatar(c)}.\n\nUsar como local da ocorrência?`, [
          { text: 'Não', style: 'cancel' },
          { text: 'Usar', onPress: () => usarCoord(c) },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Foto', e?.message || 'Não foi possível obter a foto.');
    }
  }
  function legendaFoto(i: number, legenda: string) {
    set('fotos', (formRef.current?.fotos || []).map((f: FotoAlvara, k: number) => (k === i ? { ...f, legenda } : f)));
  }
  function removerFoto(i: number) {
    Alert.alert('Remover foto', `Remover a foto ${i + 1}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => set('fotos', (formRef.current?.fotos || []).filter((_: FotoAlvara, k: number) => k !== i)) },
    ]);
  }
  function fecharSAD() { setSadVisible(false); setSadQuery(''); setSadResultados(null); }
  async function buscarNoSAD() {
    if (!sadQuery.trim()) return;
    setBuscandoSAD(true);
    try {
      const res = await buscarPessoasSAD(sadQuery.trim());
      setSadResultados(res);
    } catch { Alert.alert('Erro', 'Não foi possível conectar ao SAD.'); }
    finally { setBuscandoSAD(false); }
  }
  function selecionarSAD(p: PessoaSAD) {
    setForm(prev => ({
      ...prev,
      ...(prev.origem_tipo === 'orgao'
        ? { orgao_demandante: prev.orgao_demandante || p.orgao || p.nome || '' }
        : { nome_solicitante: p.nome || prev.nome_solicitante, cpf: applyCPF(p.cpf || ''), telefone: applyPhone(p.telefone || '') }),
      endereco: prev.endereco || p.endereco || '',
      bairro: prev.bairro || p.bairro || '',
      municipio: prev.municipio || p.municipio || '',
      gps_lat: prev.gps_lat ?? p.gps_lat,
      gps_lng: prev.gps_lng ?? p.gps_lng,
      sad_pessoa_id: String(p.id),
    }));
    scheduleAutoSave();
    fecharSAD();
  }

  useEffect(() => {
    const b = BackHandler.addEventListener('hardwareBackPress', () => {
      if (temConteudo(formRef.current)) {
        Alert.alert('Sair?', 'O rascunho foi salvo automaticamente.', [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Sair', onPress: () => router.back() },
        ]);
        return true;
      }
      return false;
    });
    return () => b.remove();
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
          <Text style={styles.topTitle}>{editando ? 'Editar Vistoria' : 'Nova Vistoria'}</Text>
          <Text style={styles.autoSaveHint}>● Rascunho automático</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📋 Quem pediu a vistoria" />
          <BtnGroup options={['Pessoa', 'Órgão']} value={orgao ? 'Órgão' : 'Pessoa'} onChange={(v) => set('origem_tipo', v === 'Órgão' ? 'orgao' : 'pessoa')} />
          <View style={{ height: 10 }} />
          <TouchableOpacity style={styles.sadBtn} onPress={() => setSadVisible(true)}>
            <Text style={styles.sadBtnText}>🔍 Buscar no SAD{form.sad_pessoa_id ? ' ✓ Vinculado' : ''}</Text>
          </TouchableOpacity>
          {orgao ? (
            <>
              <Field label="Órgão"><Input value={form.orgao_demandante} onChangeText={(v: string) => set('orgao_demandante', v)} placeholder="Ex: Procuradoria-Geral do Município – PGM" /></Field>
              <Field label="Documento"><Input value={form.documento_origem} onChangeText={(v: string) => set('documento_origem', v)} placeholder="Ex: Ofício nº 722/2026 – PGM; Notícia de Fato nº 040.2026.001903" /></Field>
              <Field label="O que pediram para avaliar"><Input value={form.escopo_pedido} onChangeText={(v: string) => set('escopo_pedido', v)} placeholder="Copie do ofício o que foi pedido (ex.: condições da ponte, do solo e da erosão)" multiline /></Field>
            </>
          ) : (
            <>
              <Field label="Nome"><Input value={form.nome_solicitante} onChangeText={(v: string) => set('nome_solicitante', v)} placeholder="Nome do solicitante" /></Field>
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Field label="CPF (se tiver)"><Input value={form.cpf} onChangeText={(v: string) => set('cpf', applyCPF(v))} placeholder="000.000.000-00" keyboardType="numeric" /></Field></View>
                <View style={{ flex: 1 }}><Field label="Telefone"><Input value={form.telefone} onChangeText={(v: string) => set('telefone', applyPhone(v))} placeholder="(00) 00000-0000" keyboardType="numeric" /></Field></View>
              </View>
            </>
          )}
          <Field label="Protocolo do SAD"><Input value={form.protocolo} onChangeText={(v: string) => set('protocolo', v)} placeholder="Ex: 144/2026 — necessário para enviar ao SAD" /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📍 Local da ocorrência" />
          <Field label="Zona"><BtnGroup options={ZONAS} value={form.localizacao} onChange={(v) => set('localizacao', v)} /></Field>
          <Field label="Endereço / local"><Input value={form.endereco} onChangeText={(v: string) => set('endereco', v)} placeholder="Rua, número — ou o lugar na comunidade" /></Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Bairro / Comunidade"><Input value={form.bairro} onChangeText={(v: string) => set('bairro', v)} placeholder="Bairro ou comunidade" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Município/UF"><Input value={form.municipio} onChangeText={(v: string) => set('municipio', v)} placeholder="Tefé/AM" /></Field></View>
          </View>
          <Field label="Ponto de referência"><Input value={form.ponto_referencia} onChangeText={(v: string) => set('ponto_referencia', v)} placeholder="Próximo a..." /></Field>
          <TouchableOpacity style={styles.gpsBtn} onPress={capturaGPS}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><IconeGps size={18} /><Text style={styles.gpsBtnText}>{form.gps_lat ? 'Capturar GPS de novo (aqui onde estou)' : 'Capturar GPS (aqui onde estou)'}</Text></View>
          </TouchableOpacity>
          <Field label="Coordenadas (automáticas ou digitadas)">
            <TextInput style={styles.input} value={coordTexto} onChangeText={setCoordTexto} onEndEditing={confirmarCoordTexto}
              placeholder={`-3.355600, -64.707700  ou  3°21'20"S 64°42'27"W`} placeholderTextColor={Colors.textSecondary} />
          </Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="🔍 Ocorrência e risco" />
          <Field label="Tipo de ocorrência"><BtnGroup options={TIPOS_OCORRENCIA} value={form.tipificacao} onChange={(v) => set('tipificacao', v)} /></Field>
          {form.tipificacao === 'Outros' && (
            <Field label="Qual?"><Input value={form.qual_tipificacao_outro} onChangeText={(v: string) => set('qual_tipificacao_outro', v)} placeholder="Descreva o tipo de ocorrência" /></Field>
          )}
          <Field label="Nível de risco"><BtnGroup options={NIVEIS_RISCO} value={form.nivel_risco} onChange={(v) => set('nivel_risco', v)} colorMap={NIVEL_CORES} /></Field>
          <Field label="Risco iminente? (pode acontecer a qualquer momento)"><SimNao value={form.risco_iminente} onChange={(v) => set('risco_iminente', v)} /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="📝 O que encontrei" />
          <Field label="O que constatei (o que eu vi)"><Input value={form.descricao_situacao} onChangeText={(v: string) => set('descricao_situacao', v)} placeholder="Descreva o que foi visto no local" multiline /></Field>
          <BtnGerarIA loading={gerandoIA === 'descricao_situacao'} onPress={() => gerarComIA('descricao_situacao')} />
          <Field label="O que foi relatado (o que contaram)"><Input value={form.relatado} onChangeText={(v: string) => set('relatado', v)} placeholder="Ex: moradores relatam acidentes; alguns passam por baixo da ponte" multiline /></Field>
        </View>

        <View style={styles.section}>
          <SectionTitle title="👥 Atingidos" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Pessoas afetadas"><Input value={form.pessoas_afetadas} onChangeText={(v: string) => set('pessoas_afetadas', v)} keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Famílias afetadas"><Input value={form.familias_afetadas} onChangeText={(v: string) => set('familias_afetadas', v)} keyboardType="numeric" /></Field></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Desabrigados"><Input value={form.desabrigados} onChangeText={(v: string) => set('desabrigados', v)} keyboardType="numeric" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Desalojados"><Input value={form.desalojados} onChangeText={(v: string) => set('desalojados', v)} keyboardType="numeric" /></Field></View>
          </View>
        </View>

        {mostraImovel(form.tipificacao) && (
          <View style={styles.section}>
            <SectionTitle title="🏠 Imóvel" />
            <Field label="Tipo de imóvel"><BtnGroup options={TIPOS_IMOVEL} value={form.tipo_imovel} onChange={(v) => set('tipo_imovel', v)} /></Field>
            <Field label="Material de construção"><BtnGroup options={MATERIAIS} value={form.material_construcao} onChange={(v) => set('material_construcao', v)} /></Field>
            {form.material_construcao === 'Outros' && (
              <Field label="Qual material?"><Input value={form.qual_material_outro} onChangeText={(v: string) => set('qual_material_outro', v)} placeholder="Descreva o material" /></Field>
            )}
            <Field label="Propriedade"><BtnGroup options={PROPRIEDADES} value={form.propriedade} onChange={(v) => set('propriedade', v)} /></Field>
            <Field label="Situação do imóvel"><BtnGroup options={SITUACOES_IMOVEL} value={form.situacao_imovel} onChange={(v) => set('situacao_imovel', v)} /></Field>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle title="✅ Medidas recomendadas" />
          {MEDIDAS.map(m => (
            <Checkbox key={m} label={m} checked={form.medidas.includes(m)} onToggle={() => alternar('medidas', m)} />
          ))}
          <View style={{ height: 10 }} />
          <Field label="Outras medidas / observações"><Input value={form.recomendacoes} onChangeText={(v: string) => set('recomendacoes', v)} placeholder="Uma por linha" multiline /></Field>
          <BtnGerarIA loading={gerandoIA === 'recomendacoes'} onPress={() => gerarComIA('recomendacoes')} />
        </View>

        <View style={styles.section}>
          <SectionTitle title="📄 Encaminhar para" />
          {ORGAOS_DESTINO.map(o => (
            <Checkbox key={o.sigla} label={o.rotulo} checked={form.orgao_destino.includes(o.sigla)} onToggle={() => alternar('orgao_destino', o.sigla)} />
          ))}
          {form.orgao_destino.includes('Outros') && (
            <Field label="Qual órgão?"><Input value={form.qual_orgao_outro} onChangeText={(v: string) => set('qual_orgao_outro', v)} placeholder="Nome completo e sigla (ex.: Secretaria Municipal de Saúde – SEMSA)" /></Field>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title={`📷 Fotos do relatório (${form.fotos.length}/${MAX_FOTOS_VISTORIA})`} />
          {form.fotos.map((f: FotoAlvara, i: number) => (
            <View key={f.uri} style={styles.fotoItem}>
              <Image source={{ uri: f.uri }} style={styles.fotoImg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Foto {String(i + 1).padStart(2, '0')} — legenda</Text>
                <Input value={f.legenda} onChangeText={(v: string) => legendaFoto(i, v)} placeholder="Ex: Piso com tábuas soltas" />
                <TouchableOpacity onPress={() => removerFoto(i)}><Text style={styles.fotoRemover}>Remover</Text></TouchableOpacity>
              </View>
            </View>
          ))}
          {form.fotos.length < MAX_FOTOS_VISTORIA && (
            <View style={styles.row}>
              <TouchableOpacity style={[styles.gpsBtn, { flex: 1 }]} onPress={() => adicionarFoto('camera')}><Text style={styles.gpsBtnText}>📸 Câmera</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.gpsBtn, { flex: 1 }]} onPress={() => adicionarFoto('galeria')}><Text style={styles.gpsBtnText}>🖼️ Galeria</Text></TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle title="👤 Vistoriador" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Nome do vistoriador"><Input value={form.nome_vistoriador} onChangeText={(v: string) => set('nome_vistoriador', v)} placeholder="Nome do agente" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Matrícula"><Input value={form.matricula} onChangeText={(v: string) => set('matricula', v)} placeholder="DC-0000" /></Field></View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={salvar}>
          <Text style={styles.saveBtnText}>Salvar Vistoria</Text>
        </TouchableOpacity>
        <Text style={styles.offlineHint}>✓ Salvo offline · Envie ao SAD pela tela da vistoria</Text>
      </ScrollView>

      <Modal visible={sadVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={fecharSAD}>
        <View style={styles.sadOverlay}>
          <View style={styles.sadDialog}>
            <Text style={styles.sadDialogTitle}>🔍 Buscar no SAD</Text>
            <TextInput
              style={styles.sadDialogInput}
              value={sadQuery}
              onChangeText={setSadQuery}
              placeholder="Nome, CPF ou órgão"
              placeholderTextColor={Colors.textSecondary}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={buscarNoSAD}
            />
            <TouchableOpacity style={[styles.sadDialogBuscarBtn, buscandoSAD && { opacity: 0.6 }]} onPress={buscarNoSAD} disabled={buscandoSAD}>
              <Text style={styles.sadDialogBuscarText}>{buscandoSAD ? 'Buscando…' : 'Buscar'}</Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {sadResultados !== null && sadResultados.length === 0 && (
                <Text style={styles.sadSemResultados}>Nenhum resultado encontrado.</Text>
              )}
              {(sadResultados ?? []).map(p => (
                <TouchableOpacity key={p.id} style={styles.sadResultItem} onPress={() => selecionarSAD(p)}>
                  <Text style={styles.sadResultNome}>{p.nome}</Text>
                  <Text style={styles.sadResultSub}>{p.cpf}{p.orgao ? ` · ${p.orgao}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sadCancelarBtn} onPress={fecharSAD}>
              <Text style={styles.sadCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  sadBtn: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, borderWidth: 0.5, borderColor: Colors.primary, marginBottom: 10 },
  sadBtnText: { color: Colors.primary, fontSize: 13 },
  sadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  sadDialog: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16 },
  sadDialogTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  sadDialogInput: { backgroundColor: Colors.background, borderRadius: 8, padding: 11, color: Colors.textPrimary, fontSize: 13, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 8 },
  sadDialogBuscarBtn: { backgroundColor: Colors.primary, borderRadius: 8, padding: 11, alignItems: 'center', marginBottom: 8 },
  sadDialogBuscarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sadResultItem: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sadResultNome: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  sadResultSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  sadSemResultados: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  sadCancelarBtn: { marginTop: 8, alignItems: 'center', padding: 8 },
  sadCancelarText: { color: Colors.danger, fontSize: 13 },
  iaBtn: { backgroundColor: Colors.background, borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, marginTop: -4, marginBottom: 10 },
  iaBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, margin: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  fotoItem: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  fotoImg: { width: 90, height: 100, borderRadius: 8, backgroundColor: Colors.background },
  fotoRemover: { color: Colors.danger, fontSize: 12, marginTop: 4 },
  offlineHint: { color: Colors.success, fontSize: 12, textAlign: 'center', marginBottom: 20 },
});
