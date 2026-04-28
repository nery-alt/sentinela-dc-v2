import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useCollection } from '../../hooks/useRecord';

const NIVEL_CORES: Record<string, string> = {
  'Baixo': Colors.success,
  'Médio': Colors.warning,
  'Alto': '#E07B00',
  'Muito Alto': Colors.danger,
};

export default function Vistorias() {
  const vistorias = useCollection('vistorias');
  const [busca, setBusca] = useState('');

  const filtradas = vistorias.filter(v =>
    v.nome_solicitante?.toLowerCase().includes(busca.toLowerCase()) ||
    v._raw.protocolo?.includes(busca)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Vistoria</Text>
          <Text style={styles.subtitle}>{vistorias.length} registro{vistorias.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou protocolo..."
          placeholderTextColor={Colors.textSecondary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma vistoria encontrada</Text>
            <Text style={styles.emptyHint}>Toque em + para registrar</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/vistoria/detalhe?id=${item.id}`)}>
            <Text style={styles.cardName}>{item.nome_solicitante}</Text>
            <Text style={styles.cardDetail}>{item._raw.endereco || 'Endereço não informado'}</Text>
            {item._raw.protocolo ? <Text style={styles.cardDetail}>Protocolo: {item._raw.protocolo}</Text> : null}
            <View style={styles.badgeRow}>
              {item._raw.rascunho ? (
                <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
                  <Text style={styles.badgeText}>Rascunho</Text>
                </View>
              ) : (
                <>
                  {item._raw.tipificacao ? (
                    <View style={[styles.badge, { backgroundColor: Colors.primary }]}>
                      <Text style={styles.badgeText}>{item._raw.tipificacao}</Text>
                    </View>
                  ) : null}
                  {item._raw.nivel_risco ? (
                    <View style={[styles.badge, { backgroundColor: NIVEL_CORES[item._raw.nivel_risco] || Colors.surface }]}>
                      <Text style={styles.badgeText}>{item._raw.nivel_risco}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/vistoria/nova')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16, paddingTop: 52 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  searchBox: { marginHorizontal: 16, marginBottom: 12 },
  searchInput: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 0.5, borderColor: Colors.border },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  cardDetail: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptyHint: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
