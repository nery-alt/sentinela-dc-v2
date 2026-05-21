import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useMemo } from 'react';
import { Colors } from '../../constants/colors';
import { useCollection } from '../../hooks/useRecord';
import { exportRelatorioMensalPdf } from '../../lib/pdf';

const RISK_COLORS: Record<string, string> = {
  'Muito Alto': '#8B5CF6',
  'Alto': '#E24B4A',
  'Médio': '#FF6B00',
  'Baixo': '#1D9E75',
};

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChartTitle({ title }: { title: string }) {
  return <Text style={styles.chartTitle}>{title}</Text>;
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const flex = max > 0 ? Math.max(count / max, count > 0 ? 0.03 : 0) : 0;
  return (
    <View style={styles.hbarRow}>
      <Text style={styles.hbarLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.hbarTrack}>
        <View style={[styles.hbarFill, { flex: flex, backgroundColor: color }]} />
        <View style={{ flex: Math.max(1 - flex, 0.001) }} />
      </View>
      <Text style={styles.hbarCount}>{count}</Text>
    </View>
  );
}

function RankRow({ rank, label, count }: { rank: number; label: string; count: number }) {
  return (
    <View style={styles.rankRow}>
      <View style={[styles.rankBadge, rank === 1 && { backgroundColor: Colors.primary }]}>
        <Text style={styles.rankBadgeText}>{rank}</Text>
      </View>
      <Text style={styles.rankLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.rankCount}>{count}</Text>
    </View>
  );
}

export default function Painel() {
  const { records: vistorias, tick: t1 } = useCollection('vistorias');
  const { records: tecnicas, tick: t2 } = useCollection('vistorias_tecnicas');
  const { records: cadastros, tick: t3 } = useCollection('cadastros');

  const stats = useMemo(() => {
    const now = Date.now();
    const ago30 = now - 30 * 24 * 60 * 60 * 1000;

    // — Resumo geral —
    const totalV = vistorias.length;
    const totalT = tecnicas.length;
    const totalC = cadastros.length;

    const riscoAlto = vistorias.filter(v =>
      v._raw.nivel_risco === 'Alto' || v._raw.nivel_risco === 'Muito Alto'
    ).length;

    const sync =
      vistorias.filter(v => v._raw.sincronizado).length +
      tecnicas.filter(v => v._raw.sincronizado).length +
      cadastros.filter(v => v._raw.sincronizado).length;

    const pendentes = totalV + totalT + totalC - sync;

    // — Últimos 30 dias —
    const days: { short: string; full: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = vistorias.filter(
        v => v._raw.created_at >= dayStart && v._raw.created_at < dayEnd
      ).length;
      days.push({
        short: `${d.getDate()}`,
        full: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        count,
      });
    }
    const v30 = days.reduce((s, d) => s + d.count, 0);
    const mediaDiaria = (v30 / 30).toFixed(1);

    // — Tipo de ocorrência —
    const byTipo: Record<string, number> = {};
    vistorias.forEach(v => {
      const t = v._raw.tipificacao || 'Não informado';
      byTipo[t] = (byTipo[t] || 0) + 1;
    });
    const tipoEntries = Object.entries(byTipo).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // — Nível de risco —
    const byRisco: Record<string, number> = { 'Muito Alto': 0, 'Alto': 0, 'Médio': 0, 'Baixo': 0 };
    vistorias.forEach(v => {
      const n = v._raw.nivel_risco;
      if (n && byRisco[n] !== undefined) byRisco[n]++;
    });
    const riscoEntries = Object.entries(byRisco).map(([label, count]) => ({
      label, count, color: RISK_COLORS[label] || Colors.textSecondary,
    }));

    // — Top 5 bairros —
    const byBairro: Record<string, number> = {};
    [...vistorias, ...tecnicas].forEach(v => {
      const b = (v._raw.bairro || '').trim();
      if (b) byBairro[b] = (byBairro[b] || 0) + 1;
    });
    const top5 = Object.entries(byBairro).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { totalV, totalT, totalC, riscoAlto, sync, pendentes, days, v30, mediaDiaria, tipoEntries, riscoEntries, top5 };
  }, [vistorias, tecnicas, cadastros, t1, t2, t3]);

  const maxDay = Math.max(...stats.days.map(d => d.count), 1);
  const maxTipo = Math.max(...stats.tipoEntries.map(e => e[1]), 1);
  const maxRisco = Math.max(...stats.riscoEntries.map(e => e.count), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      <View style={styles.header}>
        <Text style={styles.title}>Painel Operacional</Text>
        <Text style={styles.subtitle}>Atualização em tempo real</Text>
      </View>

      {/* ── Resumo Geral ─────────────────────────── */}
      <View style={styles.statGrid}>
        <StatCard label="Vistorias" value={stats.totalV} />
        <StatCard label="Vis. Técnicas" value={stats.totalT} />
        <StatCard label="Cadastros" value={stats.totalC} />
        <StatCard label="Risco Alto" value={stats.riscoAlto} color={Colors.danger} />
        <StatCard label="Sincronizados" value={stats.sync} color={Colors.success} />
        <StatCard label="Pendentes" value={stats.pendentes} color="#F59E0B" />
      </View>

      {/* ── Últimos 30 dias ───────────────────────── */}
      <View style={styles.card}>
        <ChartTitle title="📊 Vistorias — Últimos 30 dias" />
        <Text style={styles.chartMeta}>{stats.v30} ocorrências · Média {stats.mediaDiaria} vis/dia</Text>
        {stats.v30 === 0 ? (
          <Text style={styles.empty}>Nenhuma vistoria nos últimos 30 dias</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
            <View style={styles.dayChart}>
              {stats.days.filter(d => d.count > 0).map((d, i) => {
                const h = maxDay > 0 ? Math.round((d.count / maxDay) * 80) : 6;
                return (
                  <View key={i} style={styles.dayCol}>
                    <Text style={styles.dayCount}>{d.count}</Text>
                    <View style={styles.dayTrack}>
                      <View style={[styles.dayBar, { height: Math.max(h, 6), backgroundColor: Colors.primary }]} />
                    </View>
                    <Text style={styles.dayLabel} numberOfLines={1}>{d.full}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Tipo de Ocorrência ─────────────────────── */}
      <View style={styles.card}>
        <ChartTitle title="📋 Por Tipo de Ocorrência" />
        {stats.tipoEntries.length === 0 ? (
          <Text style={styles.empty}>Sem vistorias registradas</Text>
        ) : (
          stats.tipoEntries.map(([tipo, count]) => (
            <HBar key={tipo} label={tipo} count={count} max={maxTipo} color={Colors.primary} />
          ))
        )}
      </View>

      {/* ── Nível de Risco ────────────────────────── */}
      <View style={styles.card}>
        <ChartTitle title="⚠️ Por Nível de Risco" />
        {stats.riscoEntries.map(({ label, count, color }) => (
          <HBar key={label} label={label} count={count} max={maxRisco} color={color} />
        ))}
      </View>

      {/* ── Top 5 Bairros ─────────────────────────── */}
      <View style={styles.card}>
        <ChartTitle title="📍 Top 5 Bairros com mais ocorrências" />
        {stats.top5.length === 0 ? (
          <Text style={styles.empty}>Sem dados de bairro</Text>
        ) : (
          stats.top5.map(([bairro, count], i) => (
            <RankRow key={bairro} rank={i + 1} label={bairro} count={count} />
          ))
        )}
      </View>

      {/* ── Exportar PDF ──────────────────────────── */}
      <TouchableOpacity
        style={styles.exportBtn}
        onPress={async () => {
          try {
            await exportRelatorioMensalPdf({
              totalV: stats.totalV,
              totalT: stats.totalT,
              totalC: stats.totalC,
              riscoAlto: stats.riscoAlto,
              sync: stats.sync,
              pendentes: stats.pendentes,
              tipoEntries: stats.tipoEntries,
              riscoEntries: stats.riscoEntries,
              top5: stats.top5,
              mediaDiaria: stats.mediaDiaria,
            });
          } catch {
            Alert.alert('Erro', 'Não foi possível gerar o PDF.');
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.exportBtnText}>📄  Exportar Relatório Mensal PDF</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginTop: 8 },
  statCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    alignItems: 'center', flex: 1, minWidth: '29%',
    borderWidth: 0.5, borderColor: Colors.border,
  },
  statValue: { color: Colors.textPrimary, fontSize: 26, fontWeight: 'bold' },
  statLabel: { color: Colors.textSecondary, fontSize: 10, marginTop: 3, textAlign: 'center' },

  // Card wrapper
  card: {
    backgroundColor: Colors.surface, borderRadius: 12,
    marginHorizontal: 12, marginTop: 10,
    padding: 14, borderWidth: 0.5, borderColor: Colors.border,
  },
  chartTitle: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  chartMeta: { color: Colors.textSecondary, fontSize: 11 },
  empty: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', paddingVertical: 14 },

  // 30-day vertical bar chart
  dayChart: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4 },
  dayCol: { width: 42, alignItems: 'center', marginHorizontal: 3 },
  dayTrack: { height: 80, justifyContent: 'flex-end', alignItems: 'center' },
  dayBar: { width: 16, borderRadius: 3 },
  dayCount: { color: Colors.textPrimary, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  dayLabel: { color: Colors.textPrimary, fontSize: 10, marginTop: 5, width: 42, textAlign: 'center' },

  // Horizontal bars
  hbarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hbarLabel: { color: Colors.textSecondary, fontSize: 11, width: 110, marginRight: 8, lineHeight: 14 },
  hbarTrack: {
    flex: 1, height: 14, flexDirection: 'row',
    backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden',
  },
  hbarFill: { height: 14, borderRadius: 4 },
  hbarCount: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', width: 28, textAlign: 'right', marginLeft: 6 },

  // Ranking
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  rankBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  rankBadgeText: { color: Colors.textPrimary, fontSize: 12, fontWeight: 'bold' },
  rankLabel: { flex: 1, color: Colors.textPrimary, fontSize: 13 },
  rankCount: { color: Colors.textSecondary, fontSize: 12 },

  // Export button
  exportBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    margin: 12, marginTop: 14, padding: 16, alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
