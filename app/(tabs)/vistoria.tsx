import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';

export default function VistoriaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vistoria</Text>
      <View style={styles.content}>
        <Text style={styles.text}>Em construção</Text>
      </View>
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: Colors.textSecondary, fontSize: 18 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: { color: '#FFF', fontSize: 30, fontWeight: 'bold' },
});
