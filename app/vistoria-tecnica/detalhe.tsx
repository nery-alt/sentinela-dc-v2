import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';
import { useRecord } from '../../hooks/useRecord';
import { exportVistoriaTecnicaPdf } from '../../lib/pdf';
import { uploadFotoAlvaraSAD, enviarAlvaraSAD } from '../../lib/sadApi';
import { lerFotos } from '../../lib/fotosAlvara';

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '' || value === 0) return null;
  const display = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{display}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export default function DetalheVistoriaTecnica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { record: vistoria } = useRecord('vistorias_tecnicas', id);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  // Envia o checklist, a estrutura, as anotações e as fotos para o alvará no SAD
  async function enviarParaSAD() {
    if (!vistoria) return;
    const r: any = vistoria._raw;
    const numero = String(r.protocolo || '').trim();
    if (!/^AL[\s-]*\d{1,4}\s*\/\s*\d{4}$/i.test(numero)) {
      Alert.alert('Sem vínculo com o SAD', 'Esta vistoria não está ligada a um alvará do SAD. Toque em Editar → "Buscar no SAD", escolha o alvará (ex.: AL-094/2026) e salve.');
      return;
    }
    const fotos = lerFotos(r.fotos);
    const semLegenda = fotos.filter(f => !f.legenda.trim()).length;
    Alert.alert('Enviar ao SAD', `Enviar a vistoria para o alvará ${numero}?\n\n${fotos.length} foto(s)${semLegenda ? ` — ${semLegenda} sem legenda` : ''}.\nO que já estiver preenchido no SAD só é substituído pelos campos que você preencheu aqui.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar', onPress: async () => {
        try {
          const enviadas: { ordem: number; url: string; legenda: string }[] = [];
          for (let i = 0; i < fotos.length; i++) {
            setEnviando(`Enviando foto ${i + 1} de ${fotos.length}…`);
            const url = await uploadFotoAlvaraSAD(fotos[i].uri, numero, i + 1);
            enviadas.push({ ordem: i + 1, url, legenda: fotos[i].legenda });
          }
          setEnviando('Enviando dados…');
          const b = (v: any) => (v === 1 || v === true ? true : v === 0 || v === false ? false : null);
          const hoje = new Date();
          const dataVistoria = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
          const tipoExt = r.tipo_extintor === 'Outro' ? (r.qual_extintor_outro || '') : (r.tipo_extintor === 'Pó ABC' ? 'Pó Químico ABC' : r.tipo_extintor);
          const res = await enviarAlvaraSAD({
            numero,
            campos: {
              cnpj: r.cnpj, nome_responsavel: r.nome_responsavel, cpf_responsavel: r.cpf_responsavel,
              telefone: r.telefone, endereco: r.endereco, bairro: r.bairro,
              gps_lat: r.gps_lat, gps_lng: r.gps_lng, tipo_estabelecimento: r.tipo_estabelecimento,
              area_total: r.area_total, capacidade_pessoas: r.capacidade_pessoas,
              classificacao_risco: r.classificacao_risco, classificacao_porte: r.classificacao_porte,
              possui_extintor: b(r.possui_extintor), qtd_extintores: r.qtd_extintores, tipo_extintor: tipoExt,
              extintor_validade: b(r.extintor_validade), extintor_localizacao_ok: b(r.extintor_localizacao_ok),
              sinalizacao_emergencia: b(r.sinalizacao_emergencia), saida_desobstruida: b(r.saida_desobstruida),
              qtd_saidas: r.qtd_saidas, rotas_fuga_ok: b(r.rotas_fuga_ok),
              instalacao_irregular: b(r.instalacao_irregular), possui_glp: b(r.possui_glp),
              glp_armazenamento_ok: b(r.glp_armazenamento_ok), sistema_fixo_incendio: b(r.sistema_fixo_incendio),
              qual_sistema_fixo: r.qual_sistema_fixo, iluminacao_emergencia: b(r.iluminacao_emergencia),
              obs_iluminacao: r.obs_iluminacao, hidrante_reserva: b(r.hidrante_reserva), obs_hidrante: r.obs_hidrante,
              planta_baixa: b(r.planta_baixa), obs_planta_baixa: r.obs_planta_baixa,
              estrutura_conservacao: r.estrutura_conservacao, estrutura_trincas: r.estrutura_trincas,
              estrutura_infiltracao: b(r.estrutura_infiltracao), estrutura_cobertura_ok: b(r.estrutura_cobertura_ok),
              estrutura_obs: r.estrutura_obs, observacoes: r.observacoes, descricao_tecnica: r.descricao_tecnica,
              nome_vistoriador: r.nome_vistoriador, matricula_vistoriador: r.matricula,
              data_vistoria: dataVistoria,
            },
            fotos: enviadas,
          });
          await database.write(async () => {
            const rec = await database.collections.get('vistorias_tecnicas').find(id);
            await rec.update((x: any) => { Object.assign(x._raw, { enviado_sad_em: Date.now(), sincronizado: true }); });
          });
          Alert.alert('Enviado ao SAD ✓', `Alvará ${numero} atualizado: ${res.campos} campo(s) e ${res.fotos} foto(s).\n\nNo SAD, abra o alvará e clique em Laudo.`);
        } catch (e: any) {
          Alert.alert('Não foi possível enviar', `${e?.message || 'Erro desconhecido'}\n\nVerifique a internet e tente de novo. Nada foi perdido no celular.`);
        } finally {
          setEnviando(null);
        }
      } },
    ]);
  }

  async function handleExportPdf() {
    if (!vistoria) return;
    setExportingPdf(true);
    try {
      await exportVistoriaTecnicaPdf(vistoria._raw);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function excluir() {
    Alert.alert('Excluir vistoria técnica', `Deseja excluir a vistoria de ${vistoria?._raw?.nome_estabelecimento}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            const rec = await database.collections.get('vistorias_tecnicas').find(id);
            await rec.destroyPermanently();
          });
          router.back();
        }
      }
    ]);
  }

  if (!vistoria) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: Colors.textSecondary }}>Carregando...</Text>
    </View>
  );

  const r = vistoria._raw;
  const orgaos = r.orgao_destino ? (() => { try { return JSON.parse(r.orgao_destino).join(', '); } catch { return r.orgao_destino; } })() : '';
  const resultadoColor = r.apto_alvara === true ? Colors.success : r.apto_alvara === false ? Colors.danger : null;
  const resultadoText = r.apto_alvara === true ? '✓ APTO PARA ALVARÁ' : r.apto_alvara === false ? '✗ INAPTO — NECESSITA ADEQUAÇÕES' : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Vistoria Técnica</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/vistoria-tecnica/nova?id=${id}`)}>
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={excluir}>
            <Text style={styles.deleteBtnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.exportBar, { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={[styles.pdfBtn, exportingPdf && { opacity: 0.5 }]} onPress={handleExportPdf} disabled={exportingPdf}>
          <Text style={styles.pdfBtnText}>{exportingPdf ? 'Gerando PDF…' : '📄 Exportar PDF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sadEnviarBtn, !!enviando && { opacity: 0.5 }]} onPress={enviarParaSAD} disabled={!!enviando}>
          <Text style={styles.pdfBtnText}>{enviando || (r.enviado_sad_em ? '📤 Reenviar ao SAD' : '📤 Enviar ao SAD')}</Text>
        </TouchableOpacity>
      </View>
      {!!r.enviado_sad_em && (
        <Text style={styles.enviadoHint}>✓ Enviado ao SAD em {new Date(r.enviado_sad_em).toLocaleString('pt-BR')}</Text>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.nameCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{r.nome_estabelecimento?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.nameText}>{r.nome_estabelecimento}</Text>
          {resultadoColor && resultadoText && (
            <View style={[styles.resultBanner, { borderColor: resultadoColor, backgroundColor: resultadoColor + '20' }]}>
              <Text style={[styles.resultBannerText, { color: resultadoColor }]}>{resultadoText}</Text>
            </View>
          )}
          {r.rascunho && (
            <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
              <Text style={styles.badgeText}>Rascunho</Text>
            </View>
          )}
        </View>

        <Section title="🏢 Dados do Estabelecimento">
          <Row label="CNPJ" value={r.cnpj} />
          <Row label="Responsável" value={r.nome_responsavel} />
          <Row label="CPF do Responsável" value={r.cpf_responsavel} />
          <Row label="Telefone" value={r.telefone} />
          <Row label="Endereço" value={r.endereco} />
          <Row label="Bairro" value={r.bairro} />
          <Row label="GPS" value={r.gps_lat ? `${r.gps_lat?.toFixed(6)}, ${r.gps_lng?.toFixed(6)}` : null} />
          <Row label="Tipo de Estabelecimento" value={r.tipo_estabelecimento} />
          <Row label="Área Total (m²)" value={r.area_total} />
          <Row label="Capacidade de Pessoas" value={r.capacidade_pessoas} />
          <Row label="Protocolo (alvará SAD)" value={r.protocolo} />
          <Row label="Grau de risco" value={r.classificacao_risco} />
          <Row label="Porte" value={r.classificacao_porte} />
        </Section>

        <Section title="🧯 Extintores">
          <Row label="Possui extintor" value={r.possui_extintor} />
          <Row label="Quantidade" value={r.qtd_extintores} />
          <Row label="Tipo do Extintor" value={r.tipo_extintor} />
          <Row label="Dentro do prazo" value={r.extintor_validade} />
          <Row label="Localização adequada" value={r.extintor_localizacao_ok} />
        </Section>

        <Section title="🚪 Saídas e Sinalização">
          <Row label="Sinalização de emergência" value={r.sinalizacao_emergencia} />
          <Row label="Saída desobstruída" value={r.saida_desobstruida} />
          <Row label="Qtd saídas de emergência" value={r.qtd_saidas} />
          <Row label="Rotas de fuga adequadas" value={r.rotas_fuga_ok} />
        </Section>

        <Section title="⚡ Instalações Elétricas e GLP">
          <Row label="Instalação irregular" value={r.instalacao_irregular} />
          <Row label="Possui GLP" value={r.possui_glp} />
          <Row label="GLP armazenado corretamente" value={r.glp_armazenamento_ok} />
          <Row label="Sistema fixo de combate" value={r.sistema_fixo_incendio} />
        </Section>

        <Section title="💡 Iluminação e Hidrante">
          <Row label="Iluminação de emergência" value={r.iluminacao_emergencia} />
          <Row label="Hidrante ou reserva d'água" value={r.hidrante_reserva} />
        </Section>

        <Section title="🏗️ Estrutura">
          <Row label="Conservação" value={r.estrutura_conservacao} />
          <Row label="Trincas/fissuras" value={r.estrutura_trincas} />
          <Row label="Infiltração/umidade" value={r.estrutura_infiltracao} />
          <Row label="Cobertura em boas condições" value={r.estrutura_cobertura_ok} />
          <Row label="Observação" value={r.estrutura_obs} />
        </Section>

        {lerFotos(r.fotos).length > 0 && (
          <Section title="📷 Fotos do laudo">
            {lerFotos(r.fotos).map((f, i) => (
              <View key={f.uri} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <Image source={{ uri: f.uri }} style={{ width: 60, height: 66, borderRadius: 6 }} />
                <Text style={[styles.rowValue, { textAlign: 'left' }]}>Fig.{i + 1} — {f.legenda || '(sem legenda)'}</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title="📐 Documentação">
          <Row label="Planta baixa / Croqui" value={r.planta_baixa} />
        </Section>

        <Section title="📋 Resultado">
          <Row label="Necessita adequações" value={r.necessita_adequacoes} />
          <Row label="Observações" value={r.observacoes} />
          <Row label="Descrição Técnica" value={r.descricao_tecnica} />
          <Row label="Protocolo" value={r.protocolo} />
          <Row label="Órgão Destino" value={orgaos} />
          <Row label="Situação do Imóvel" value={r.situacao_imovel} />
          <Row label="Reavaliação" value={r.reavaliacao} />
        </Section>

        <Section title="👤 Vistoriador">
          <Row label="Nome" value={r.nome_vistoriador} />
          <Row label="Matrícula" value={r.matricula} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 52, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { color: Colors.primary, fontSize: 15 },
  topTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteBtn: { backgroundColor: Colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  nameCard: { alignItems: 'center', padding: 24, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  nameText: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  resultBanner: { borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 },
  resultBannerText: { fontSize: 13, fontWeight: 'bold' },
  badge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: Colors.surface, borderRadius: 12, margin: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 13, flex: 1, textAlign: 'right' },
  exportBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  pdfBtn: { alignSelf: 'flex-start', backgroundColor: '#1A4A8C', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#3B7BC8' },
  pdfBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sadEnviarBtn: { alignSelf: 'flex-start', backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  enviadoHint: { color: Colors.success, fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
});
