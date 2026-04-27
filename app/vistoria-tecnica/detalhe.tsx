import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';

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
  const [vistoria, setVistoria] = useState<any>(null);

  useEffect(() => {
    if (id) {
      database.collections.get('vistorias_tecnicas').find(id)
        .then((r: any) => setVistoria(r))
        .catch(() => router.back());
    }
  }, [id]);

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
});
