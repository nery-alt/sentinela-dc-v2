import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getSettings, saveSettings, AppSettings } from '../../hooks/useSettings';
import { supabase } from '../../lib/supabase';

function Field({ label, placeholder, value, onChangeText, keyboardType }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

export default function Configuracoes() {
  const [form, setForm] = useState<AppSettings>({
    nomeVistoriador: '',
    matricula: '',
    cargo: '',
    nomeSecretaria: '',
    municipioUF: '',
  });

  useEffect(() => {
    getSettings().then(s => setForm(s));
  }, []);

  function set(key: keyof AppSettings) {
    return (v: string) => setForm(prev => ({ ...prev, [key]: v }));
  }

  async function salvar() {
    await saveSettings(form);
    Alert.alert('Configurações salvas', 'As configurações foram salvas com sucesso.');
  }

  function confirmarSaida() {
    Alert.alert(
      'Deseja sair?',
      'Você será desconectado do aplicativo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Dados do vistoriador e da instituição</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Dados do Vistoriador</Text>
        <Field
          label="Nome completo"
          placeholder="Nome do vistoriador"
          value={form.nomeVistoriador}
          onChangeText={set('nomeVistoriador')}
        />
        <Field
          label="Matrícula"
          placeholder="Matrícula funcional"
          value={form.matricula}
          onChangeText={set('matricula')}
        />
        <Field
          label="Cargo / Função"
          placeholder="Ex: Técnico de Defesa Civil"
          value={form.cargo}
          onChangeText={set('cargo')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏛️ Dados Institucionais</Text>
        <Field
          label="Nome da Secretaria"
          placeholder="Ex: Secretaria de Defesa Civil"
          value={form.nomeSecretaria}
          onChangeText={set('nomeSecretaria')}
        />
        <Field
          label="Município / UF"
          placeholder="Ex: São Paulo / SP"
          value={form.municipioUF}
          onChangeText={set('municipioUF')}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={salvar} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>💾  Salvar Configurações</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmarSaida} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Sair</Text>
      </TouchableOpacity>

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  section: {
    backgroundColor: Colors.surface, borderRadius: 12,
    marginHorizontal: 12, marginTop: 14,
    padding: 14, borderWidth: 0.5, borderColor: Colors.border,
  },
  sectionTitle: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginBottom: 12 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background, borderRadius: 8,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 14,
  },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    margin: 12, marginTop: 20, padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  logoutBtn: {
    borderRadius: 12, margin: 12, marginTop: 8, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#dc2626',
  },
  logoutBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
});
