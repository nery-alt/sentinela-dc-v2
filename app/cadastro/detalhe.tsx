import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '') return null;
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

export default function DetalheCadastro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cadastro, setCadastro] = useState<any>(null);

  useEffect(() => {
    if (id) {
      database.collections.get('cadastros').find(id)
        .then((r: any) => setCadastro(r))
        .catch(() => router.back());
    }
  }, [id]);

  async function excluir() {
    Alert.alert('Excluir cadastro', `Deseja excluir o cadastro de ${cadastro?._raw?.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            const rec = await database.collections.get('cadastros').find(id);
            await rec.destroyPermanently();
          });
          router.back();
        }
      }
    ]);
  }

  if (!cadastro) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: Colors.textSecondary }}>Carregando...</Text>
    </View>
  );

  const r = cadastro._raw;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Voltar</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Cadastro</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/cadastro/novo?id=${id}`)}>
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
            <Text style={styles.avatarText}>{r.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.nameText}>{r.nome}</Text>
          <View style={[styles.badge, { backgroundColor: r.rascunho ? Colors.warning : Colors.success }]}>
            <Text style={styles.badgeText}>{r.rascunho ? 'Rascunho' : 'Cadastrado'}</Text>
          </View>
        </View>

        <Section title="👤 Dados Pessoais">
          <Row label="CPF" value={r.cpf} />
          <Row label="RG" value={r.rg} />
          <Row label="Data de Nascimento" value={r.data_nascimento} />
          <Row label="Idade" value={r.idade ? `${r.idade} anos` : null} />
          <Row label="Gênero" value={r.genero} />
          <Row label="Estado Civil" value={r.estado_civil} />
          <Row label="Nacionalidade" value={r.nacionalidade} />
          <Row label="Naturalidade" value={r.naturalidade} />
          <Row label="Escolaridade" value={r.escolaridade} />
          <Row label="Profissão" value={r.profissao} />
          <Row label="Telefone" value={r.telefone} />
          <Row label="E-mail" value={r.email} />
        </Section>

        <Section title="📍 Endereço">
          <Row label="Endereço" value={r.endereco} />
          <Row label="Bairro/Comunidade" value={r.bairro} />
          <Row label="Município/UF" value={r.municipio} />
          <Row label="CEP" value={r.cep} />
          <Row label="Ponto de Referência" value={r.ponto_referencia} />
          <Row label="GPS" value={r.gps_lat ? `${r.gps_lat?.toFixed(6)}, ${r.gps_lng?.toFixed(6)}` : null} />
        </Section>

        <Section title="👨‍👩‍👧 Dados da Família">
          <Row label="Nº Pessoas na Família" value={r.num_pessoas_familia} />
          <Row label="Responsável Familiar" value={r.responsavel_familiar} />
          <Row label="Renda Familiar" value={r.renda_familiar} />
          <Row label="Programa Social" value={r.programa_social} />
        </Section>

        <Section title="🏠 Moradia">
          <Row label="Tempo que mora no local" value={r.tempo_mora_local} />
          <Row label="Nº de Cômodos" value={r.num_comodos} />
          <Row label="Tipo de Moradia" value={r.tipo_moradia} />
          <Row label="Material de Construção" value={r.material_construcao} />
          {r.material_construcao === 'Outro' && <Row label="Qual material" value={r.qual_material_construcao} />}
          <Row label="Possui Banheiro" value={r.possui_banheiro} />
          {r.possui_banheiro === false && <Row label="Obs. banheiro" value={r.obs_banheiro} />}
        </Section>

        <Section title="⚠️ Situação de Risco">
          <Row label="Área de Risco" value={r.area_risco} />
          <Row label="Afetado por desastre" value={r.afetado_desastre} />
          <Row label="Qual desastre" value={r.qual_desastre} />
        </Section>

        <Section title="🤝 Assistência">
          <Row label="Recebeu ajuda da Defesa Civil" value={r.ajuda_defesa_civil} />
          <Row label="Qual ajuda" value={r.qual_ajuda_defesa_civil} />
        </Section>

        <Section title="🔌 Infraestrutura">
          <Row label="Água Potável" value={r.agua_potavel} />
          {r.agua_potavel === false && <Row label="Obs. água" value={r.obs_agua_potavel} />}
          <Row label="Energia Elétrica" value={r.energia_eletrica} />
          {r.energia_eletrica === false && <Row label="Obs. energia" value={r.obs_energia_eletrica} />}
          <Row label="Saneamento Básico" value={r.saneamento_basico} />
          {r.saneamento_basico === false && <Row label="Obs. saneamento" value={r.obs_saneamento_basico} />}
          <Row label="Coleta de Lixo" value={r.coleta_lixo} />
          {r.coleta_lixo === false && <Row label="Obs. coleta" value={r.obs_coleta_lixo} />}
        </Section>

        <Section title="🏥 Saúde">
          <Row label="Deficiência" value={r.deficiencia} />
          <Row label="Qual deficiência" value={r.qual_deficiencia} />
          <Row label="Doença crônica" value={r.doenca_cronica} />
          <Row label="Qual doença" value={r.qual_doenca_cronica} />
          <Row label="Medicamento contínuo" value={r.medicamento_continuo} />
          <Row label="Qual medicamento" value={r.qual_medicamento} />
        </Section>

        <Section title="📄 Documentação">
          <Row label="Documentos completos" value={r.documentos_completos} />
          <Row label="Documentos faltantes" value={r.docs_faltantes} />
        </Section>

        <Section title="🚨 Assistência Imediata">
          <Row label="Necessita assistência imediata" value={r.assistencia_imediata} />
          <Row label="Prioridade" value={r.prioridade} />
        </Section>

        {r.observacoes ? (
          <Section title="📝 Observações">
            <Text style={styles.observacoes}>{r.observacoes}</Text>
          </Section>
        ) : null}
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
  badge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: Colors.surface, borderRadius: 12, margin: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 13, flex: 1, textAlign: 'right' },
  observacoes: { color: Colors.textPrimary, fontSize: 13, lineHeight: 20 },
});
