import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Erro', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>S</Text>
          </View>
          <Text style={styles.logoTitle}>Sentinela DC</Text>
          <Text style={styles.logoSub}>Defesa Civil — acesso restrito</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Funciona offline após o primeiro acesso</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoLetter: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  logoTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  logoSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  form: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: Colors.border },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderRadius: 8, padding: 12, color: Colors.textPrimary, fontSize: 14, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hint: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
