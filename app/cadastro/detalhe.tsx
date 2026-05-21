import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { database } from '../../lib/database';
import { Colors } from '../../constants/colors';
import { useRecord } from '../../hooks/useRecord';
import { exportCadastroPdf } from '../../lib/pdf';

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
  const { record: cadastro } = useRecord('cadastros', id);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportPdf() {
    if (!cadastro) return;
    setExportingPdf(true);
    try {
      await exportCadastroPdf(cadastro);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function excluir() {
    Alert.alert('Excluir cadastro', `Deseja excluir o cadastro de ${cadastro?.nome}?`, [
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

  const r = cadastro;

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

      <View style={styles.exportBar}>
        <TouchableOpacity style={[styles.pdfBtn, exportingPdf && { opacity: 0.5 }]} onPress={handleExportPdf} disabled={exportingPdf}>
          <Text style={styles.pdfBtnText}>{exportingPdf ? 'Gerando PDF…' : '📄 Exportar PDF'}</Text>
        </TouchableOpacity>
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
          <Row label="Data de Nascimento" value={r.dataNascimento} />
          <Row label="Idade" value={r.idade ? `${r.idade} anos` : null} />
          <Row label="Gênero" value={r.genero} />
          <Row label="Estado Civil" value={r.estadoCivil} />
          <Row label="Nacionalidade" value={r.nacionalidade} />
          <Row label="Naturalidade" value={r.naturalidade} />
          <Row label="Escolaridade" value={r.escolaridade} />
          <Row label="Profissão" value={r.profissao} />
          <Row label="Telefone" value={r.telefone} />
          <Row label="E-mail" value={r.email} />
        </Section>

        <Section title="📍 Endereço">
          <Row label="Rua / Nº" value={r.endereco} />
          <Row label="Bairro" value={r.bairro} />
          <Row label="Cidade" value={r.municipio} />
        </Section>

        <Section title="👨‍👩‍👧 Dados da Família">
          <Row label="Nº Pessoas na Família" value={r.numPessoasFamilia} />
          <Row label="Responsável Familiar" value={r.responsavelFamiliar} />
          <Row label="Renda Familiar" value={r.rendaFamiliar} />
          <Row label="Programa Social" value={r.programaSocial} />
        </Section>

        <Section title="🏠 Moradia">
          <Row label="Tempo que mora no local" value={r.tempoMoraLocal} />
          <Row label="Nº de Cômodos" value={r.numComodos} />
          <Row label="Tipo de Moradia" value={r.tipoMoradia} />
          <Row label="Material de Construção" value={r.materialConstrucao} />
          {r.materialConstrucao === 'Outro' && <Row label="Qual material" value={r.qualMaterialConstrucao} />}
          <Row label="Possui Banheiro" value={r.possuiBanheiro} />
          {r.possuiBanheiro === false && <Row label="Obs. banheiro" value={r.obsBanheiro} />}
        </Section>

        <Section title="⚠️ Situação de Risco">
          <Row label="Área de Risco" value={r.areaRisco} />
          <Row label="Afetado por desastre" value={r.afetadoDesastre} />
          <Row label="Qual desastre" value={r.qualDesastre} />
        </Section>

        <Section title="🤝 Assistência">
          <Row label="Recebeu ajuda da Defesa Civil" value={r.ajudaDefesaCivil} />
          <Row label="Qual ajuda" value={r.qualAjudaDefesaCivil} />
        </Section>

        <Section title="🔌 Infraestrutura">
          <Row label="Água Potável" value={r.aguaPotavel} />
          {r.aguaPotavel === false && <Row label="Obs. água" value={r.obsAguaPotavel} />}
          <Row label="Energia Elétrica" value={r.energiaEletrica} />
          {r.energiaEletrica === false && <Row label="Obs. energia" value={r.obsEnergiaEletrica} />}
          <Row label="Saneamento Básico" value={r.saneamentoBasico} />
          {r.saneamentoBasico === false && <Row label="Obs. saneamento" value={r.obsSaneamentoBasico} />}
          <Row label="Coleta de Lixo" value={r.coletaLixo} />
          {r.coletaLixo === false && <Row label="Obs. coleta" value={r.obsColetaLixo} />}
        </Section>

        <Section title="🏥 Saúde">
          <Row label="Deficiência" value={r.deficiencia} />
          <Row label="Qual deficiência" value={r.qualDeficiencia} />
          <Row label="Doença crônica" value={r.doencaCronica} />
          <Row label="Qual doença" value={r.qualDoencaCronica} />
          <Row label="Medicamento contínuo" value={r.medicamentoContinuo} />
          <Row label="Qual medicamento" value={r.qualMedicamento} />
        </Section>

        <Section title="📄 Documentação">
          <Row label="Documentos completos" value={r.documentosCompletos} />
          <Row label="Documentos faltantes" value={r.docsFaltantes} />
        </Section>

        <Section title="🚨 Assistência Imediata">
          <Row label="Necessita assistência imediata" value={r.assistenciaImediata} />
          <Row label="Prioridade" value={r.prioridade} />
        </Section>

        {(() => {
          if (!r.nucleoFamiliar) return null;
          let ms: any[] = [];
          try { ms = JSON.parse(r.nucleoFamiliar); } catch { return null; }
          if (!ms.length) return null;
          return (
            <Section title="👨‍👩‍👧 Núcleo Familiar">
              {ms.map((m: any, i: number) => (
                <View key={i} style={styles.membroDetalhe}>
                  <Text style={styles.membroDetalheNome}>{i + 1}. {m.nome || '—'}</Text>
                  <Text style={styles.membroDetalheInfo}>
                    {[m.parentesco, m.idade ? `${m.idade} anos` : null, m.genero === 'M' ? 'Masc.' : m.genero === 'F' ? 'Fem.' : null, m.cpf || null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))}
            </Section>
          );
        })()}

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
  membroDetalhe: { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  membroDetalheNome: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  membroDetalheInfo: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  exportBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  pdfBtn: { alignSelf: 'flex-start', backgroundColor: '#1A4A8C', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#3B7BC8' },
  pdfBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
