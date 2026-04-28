import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';
import { useRecord } from '../../hooks/useRecord';

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

export default function DetalheVistoria() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { record: vistoria } = useRecord('vistorias', id);

  async function excluir() {
    Alert.alert('Excluir vistoria', `Deseja excluir a vistoria de ${vistoria?._raw?.nome_solicitante}?`, [
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

  const r = vistoria._raw;
  const orgaos = r.orgao_destino ? (() => { try { return JSON.parse(r.orgao_destino).join(', '); } catch { return r.orgao_destino; } })() : '';

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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.nameCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{vistoria._raw.nome_solicitante?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.nameText}>{vistoria._raw.nome_solicitante}</Text>
          <View style={styles.badgeRow}>
            {r.rascunho ? (
              <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
                <Text style={styles.badgeText}>Rascunho</Text>
              </View>
            ) : (
              <>
                {r.tipificacao ? <View style={[styles.badge, { backgroundColor: Colors.primary }]}><Text style={styles.badgeText}>{r.tipificacao}</Text></View> : null}
                {r.nivel_risco ? <View style={[styles.badge, { backgroundColor: NIVEL_CORES[r.nivel_risco] || Colors.surface }]}><Text style={styles.badgeText}>{r.nivel_risco}</Text></View> : null}
              </>
            )}
          </View>
        </View>

        <Section title="📋 Dados do Solicitante">
          <Row label="CPF" value={r.cpf} />
          <Row label="RG" value={r.rg} />
          <Row label="Telefone" value={r.telefone} />
          <Row label="E-mail" value={r.email} />
          <Row label="Endereço" value={r.endereco} />
          <Row label="Bairro/Comunidade" value={r.bairro} />
          <Row label="Município/UF" value={r.municipio} />
          <Row label="Ponto de Referência" value={r.ponto_referencia} />
          <Row label="Protocolo" value={r.protocolo} />
          <Row label="GPS" value={r.gps_lat ? `${r.gps_lat?.toFixed(6)}, ${r.gps_lng?.toFixed(6)}` : null} />
        </Section>

        <Section title="🔍 Dados da Vistoria">
          <Row label="Tipificação" value={r.tipificacao} />
          <Row label="Nível de Risco" value={r.nivel_risco} />
          <Row label="Localização" value={r.localizacao} />
          <Row label="Tipo de Imóvel" value={r.tipo_imovel} />
          <Row label="Material de Construção" value={r.material_construcao} />
          <Row label="Propriedade" value={r.propriedade} />
        </Section>

        <Section title="⚠️ Danos">
          <Row label="Desabrigados" value={r.desabrigados} />
          <Row label="Desalojados" value={r.desalojados} />
          <Row label="Pessoas Afetadas" value={r.pessoas_afetadas} />
          <Row label="Famílias Afetadas" value={r.familias_afetadas} />
          <Row label="Danos Materiais" value={r.danos_materiais} />
          <Row label="Endereço da Ocorrência" value={r.endereco_ocorrencia} />
          <Row label="Descrição da Situação" value={r.descricao_situacao} />
          <Row label="Recomendações" value={r.recomendacoes} />
        </Section>

        <Section title="🏠 Estrutura e Riscos">
          <Row label="Tipo de Estrutura" value={r.tipo_estrutura} />
          <Row label="Risco Estrutural" value={r.risco_estrutural} />
          <Row label="Risco Hidrológico" value={r.risco_hidrologico} />
        </Section>

        <Section title="📄 Encaminhamento">
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
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  section: { backgroundColor: Colors.surface, borderRadius: 12, margin: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 13, flex: 1, textAlign: 'right' },
});
