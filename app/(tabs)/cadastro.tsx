import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useCollection } from '../../hooks/useRecord';

export default function Cadastros() {
  const { records: cadastros, tick } = useCollection('cadastros');
  const [busca, setBusca] = useState('');

  const filtrados = cadastros.filter(c =>
    c._raw.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c._raw.cpf?.includes(busca)
  );

  function badgeColor(rascunho: boolean, prioridade: string) {
    if (rascunho) return Colors.warning;
    if (prioridade === 'Emergencial') return Colors.danger;
    if (prioridade === 'Alta') return '#E07B00';
    return Colors.success;
  }

  function badgeText(rascunho: boolean, prioridade: string, assistencia: boolean) {
    if (rascunho) return 'Rascunho';
    if (assistencia) return 'Assistência imediata';
    return prioridade || 'Cadastrado';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cadastro</Text>
          <Text style={styles.subtitle}>{cadastros.length} registro{cadastros.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou CPF..."
          placeholderTextColor={Colors.textSecondary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={item => item.id}
        extraData={tick}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum cadastro encontrado</Text>
            <Text style={styles.emptyHint}>Toque em + para cadastrar</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/cadastro/detalhe?id=${item.id}`)}>
            <Text style={styles.cardName}>{item._raw.nome}</Text>
            <Text style={styles.cardDetail}>CPF {item._raw.cpf} · {item._raw.num_pessoas_familia || 1} pessoa{(item._raw.num_pessoas_familia || 1) > 1 ? 's' : ''}</Text>
            <Text style={styles.cardDetail}>{item._raw.bairro || 'Bairro não informado'} · {item._raw.municipio || 'Município não informado'}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor(item._raw.rascunho, item._raw.prioridade) }]}>
              <Text style={styles.badgeText}>{badgeText(item._raw.rascunho, item._raw.prioridade, item._raw.assistencia_imediata)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/cadastro/novo')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 52 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  searchBox: { marginHorizontal: 16, marginBottom: 12 },
  searchInput: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 0.5, borderColor: Colors.border },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  cardDetail: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptyHint: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
