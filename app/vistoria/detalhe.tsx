import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';
import { useRecord } from '../../hooks/useRecord';
import { exportVistoriaPdf } from '../../lib/pdf';
import { lerFotos, MAX_FOTOS_VISTORIA } from '../../lib/fotosAlvara';
import { uploadFotoVistoriaSAD, enviarVistoriaSAD } from '../../lib/sadApi';
import { lerLista, textoOrgaos } from '../../lib/vistoriaOpcoes';

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '' || value === '0' || value === 0) return null;
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

const NIVEL_CORES: Record<string, string> = {
  'Baixo': Colors.success, 'Médio': Colors.warning,
  'Alto': '#E07B00', 'Muito Alto': Colors.danger,
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sim = (v: any) => v === true || v === 1;

export default function DetalheVistoria() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { record: vistoria } = useRecord('vistorias', id);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  async function handleExportPdf() {
    if (!vistoria) return;
    setExportingPdf(true);
    try {
      await exportVistoriaPdf(vistoria._raw);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  // Envia dados e fotos para o protocolo no SAD (é de lá que sai o Relatório Técnico de Vistoria)
  async function enviarParaSAD() {
    if (!vistoria) return;
    const r: any = vistoria._raw;
    const protocolo = String(r.protocolo || '').trim();
    if (!/^\d{1,5}\s*\/\s*\d{4}$/.test(protocolo)) {
      Alert.alert('Sem protocolo do SAD', 'Para enviar, a vistoria precisa do número do protocolo do SAD (ex.: 144/2026). Toque em Editar e preencha "Protocolo do SAD".');
      return;
    }
    const fotos = lerFotos(r.fotos, MAX_FOTOS_VISTORIA);
    const semLegenda = fotos.filter(f => !f.legenda.trim()).length;
    Alert.alert('Enviar ao SAD', `Enviar a vistoria para o protocolo ${protocolo}?\n\n${fotos.length} foto(s)${semLegenda ? ` — ${semLegenda} sem legenda` : ''}.\nAs fotos entram nos quadros livres do relatório; as que você colocou pelo computador no SAD não são trocadas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar', onPress: async () => {
        try {
          const enviadas: { ordem: number; url: string; legenda: string }[] = [];
          for (let i = 0; i < fotos.length; i++) {
            setEnviando(`Enviando foto ${i + 1} de ${fotos.length}…`);
            const url = await uploadFotoVistoriaSAD(fotos[i].uri, protocolo, i + 1);
            enviadas.push({ ordem: i + 1, url, legenda: fotos[i].legenda });
          }
          setEnviando('Enviando dados…');
          const medidas = lerLista(r.medidas);
          const res = await enviarVistoriaSAD({
            protocolo,
            sentinela_id: String(r.id),
            campos: {
              origem_tipo: r.origem_tipo || 'pessoa',
              solicitante_nome: r.nome_solicitante,
              orgao_demandante: r.orgao_demandante, documento_origem: r.documento_origem, escopo_pedido: r.escopo_pedido,
              endereco: r.endereco, bairro: r.bairro, municipio_uf: r.municipio, ponto_referencia: r.ponto_referencia,
              latitude: r.gps_lat, longitude: r.gps_lng, localizacao: r.localizacao,
              tipificacao: r.tipificacao, tipificacao_outro: r.qual_tipificacao_outro,
              nivel_risco: r.nivel_risco, risco_iminente: r.risco_iminente == null ? null : sim(r.risco_iminente),
              descricao_situacao: [r.descricao_situacao, r.danos_materiais].filter(Boolean).join('\n\n'),
              relatado: r.relatado,
              pessoas_afetadas: r.pessoas_afetadas, familias_afetadas: r.familias_afetadas,
              desabrigados: r.desabrigados, desalojados: r.desalojados,
              tipo_imovel: r.tipo_imovel,
              material_construcao: r.material_construcao === 'Outros' && r.qual_material_outro ? r.qual_material_outro : r.material_construcao,
              propriedade: r.propriedade, situacao_imovel: r.situacao_imovel,
              medidas, recomendacoes: r.recomendacoes,
              orgao_destino: textoOrgaos(lerLista(r.orgao_destino), r.qual_orgao_outro),
              reavaliacao: medidas.includes('Monitoramento / reavaliação') || sim(r.reavaliacao),
              vistoriador_nome: r.nome_vistoriador, vistoriador_matricula: r.matricula,
              data_vistoria: ymd(r.created_at ? new Date(r.created_at) : new Date()),
            },
            fotos: enviadas,
          });
          await database.write(async () => {
            const rec = await database.collections.get('vistorias').find(id);
            await rec.update((x: any) => { Object.assign(x._raw, { enviado_sad_em: Date.now(), sincronizado: true }); });
          });
          const aviso = res.semEspaco ? `\n\n⚠️ ${res.semEspaco} foto(s) não couberam: o relatório já tem fotos colocadas pelo computador (máximo de 8). Tire alguma no SAD e reenvie.` : '';
          Alert.alert('Enviado ao SAD ✓', `Protocolo ${res.protocolo}: dados e ${res.fotos} foto(s) recebidos.${aviso}\n\nNo SAD, abra o protocolo e clique em Relatório.`);
        } catch (e: any) {
          Alert.alert('Não foi possível enviar', `${e?.message || 'Erro desconhecido'}\n\nVerifique a internet e tente de novo. Nada foi perdido no celular.`);
        } finally {
          setEnviando(null);
        }
      } },
    ]);
  }

  async function excluir() {
    Alert.alert('Excluir vistoria', `Deseja excluir a vistoria de ${vistoria?._raw?.nome_solicitante || 'sem nome'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            const rec = await database.collections.get('vistorias').find(id);
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

  const r: any = vistoria._raw;
  const ehOrgao = r.origem_tipo === 'orgao';
  const orgaos = textoOrgaos(lerLista(r.orgao_destino), r.qual_orgao_outro);
  const medidas = lerLista(r.medidas);
  const fotos = lerFotos(r.fotos, MAX_FOTOS_VISTORIA);
  const tipo = r.tipificacao === 'Outros' && r.qual_tipificacao_outro ? r.qual_tipificacao_outro : r.tipificacao;
  const titulo = r.nome_solicitante || r.orgao_demandante || r.endereco || 'Vistoria';

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Vistoria</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/vistoria/nova?id=${id}`)}>
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
            <Text style={styles.avatarText}>{String(titulo).charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.nameText}>{titulo}</Text>
          <View style={styles.badgeRow}>
            {r.rascunho ? (
              <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
                <Text style={styles.badgeText}>Rascunho</Text>
              </View>
            ) : (
              <>
                {tipo ? <View style={[styles.badge, { backgroundColor: Colors.primary }]}><Text style={styles.badgeText}>{tipo}</Text></View> : null}
                {r.nivel_risco ? <View style={[styles.badge, { backgroundColor: NIVEL_CORES[r.nivel_risco] || Colors.surface }]}><Text style={styles.badgeText}>{r.nivel_risco}</Text></View> : null}
                {sim(r.risco_iminente) ? <View style={[styles.badge, { backgroundColor: Colors.danger }]}><Text style={styles.badgeText}>IMINENTE</Text></View> : null}
              </>
            )}
          </View>
        </View>

        <Section title="📋 Quem pediu a vistoria">
          {ehOrgao ? (
            <>
              <Row label="Órgão" value={r.orgao_demandante || r.nome_solicitante} />
              <Row label="Documento" value={r.documento_origem} />
              <Row label="O que pediram para avaliar" value={r.escopo_pedido} />
            </>
          ) : (
            <>
              <Row label="CPF" value={r.cpf} />
              <Row label="Telefone" value={r.telefone} />
            </>
          )}
          <Row label="Protocolo do SAD" value={r.protocolo} />
        </Section>

        <Section title="📍 Local da ocorrência">
          <Row label="Zona" value={r.localizacao} />
          <Row label="Endereço / local" value={r.endereco} />
          <Row label="Bairro / Comunidade" value={r.bairro} />
          <Row label="Município/UF" value={r.municipio} />
          <Row label="Ponto de referência" value={r.ponto_referencia} />
          <Row label="GPS" value={r.gps_lat ? `${Number(r.gps_lat).toFixed(6)}, ${Number(r.gps_lng).toFixed(6)}` : null} />
        </Section>

        <Section title="📝 O que encontrei">
          <Row label="Constatado" value={r.descricao_situacao} />
          <Row label="Relatado" value={r.relatado} />
          <Row label="Danos materiais" value={r.danos_materiais} />
        </Section>

        <Section title="👥 Atingidos">
          <Row label="Pessoas afetadas" value={r.pessoas_afetadas} />
          <Row label="Famílias afetadas" value={r.familias_afetadas} />
          <Row label="Desabrigados" value={r.desabrigados} />
          <Row label="Desalojados" value={r.desalojados} />
        </Section>

        <Section title="🏠 Imóvel">
          <Row label="Tipo de imóvel" value={r.tipo_imovel} />
          <Row label="Material" value={r.material_construcao === 'Outros' && r.qual_material_outro ? r.qual_material_outro : r.material_construcao} />
          <Row label="Propriedade" value={r.propriedade} />
          <Row label="Situação do imóvel" value={r.situacao_imovel} />
        </Section>

        <Section title="✅ Medidas e encaminhamento">
          <Row label="Medidas" value={medidas.join('\n')} />
          <Row label="Outras medidas" value={r.recomendacoes} />
          <Row label="Encaminhar para" value={orgaos} />
        </Section>

        {fotos.length > 0 && (
          <Section title={`📷 Fotos (${fotos.length})`}>
            {fotos.map((f, i) => (
              <View key={f.uri} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <Image source={{ uri: f.uri }} style={{ width: 60, height: 66, borderRadius: 6 }} />
                <Text style={[styles.rowValue, { textAlign: 'left' }]}>Foto {String(i + 1).padStart(2, '0')} — {f.legenda || '(sem legenda)'}</Text>
              </View>
            ))}
          </Section>
        )}

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
  nameText: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
