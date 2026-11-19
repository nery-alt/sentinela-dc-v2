import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getSettings, saveSettings, AppSettings } from '../../hooks/useSettings';
import { supabase } from '../../lib/supabase';
import { entrarNoSAD, sairDoSAD, emailSAD } from '../../lib/sadAuth';

// Conexão opcional com o SAD. Sem conectar, o app usa o acesso padrão (como antes).
function ConexaoSAD() {
  const [email, setEmail] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [emailDigitado, setEmailDigitado] = useState('');
  const [senha, setSenha] = useState('');
  const [aguarde, setAguarde] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { emailSAD().then(setEmail); }, []);

  async function conectar() {
    if (!emailDigitado.trim() || !senha) { setErro('Informe o e-mail e a senha do SAD.'); return; }
    setAguarde(true); setErro(null);
    const r = await entrarNoSAD(emailDigitado, senha);
    setAguarde(false);
    if (!r.ok) { setErro(r.erro ?? 'Não foi possível conectar ao SAD.'); return; }
    setSenha(''); setAbrindo(false);
    setEmail(await emailSAD());
  }

  function desconectar() {
    Alert.alert('Desconectar do SAD?', 'O app volta a usar o acesso padrão ao SAD.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: async () => { await sairDoSAD(); setEmail(null); } },
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔗 Conexão com o SAD</Text>
      <Text style={styles.sadStatus}>
        {email ? `Conectado ao SAD como ${email}` : 'Não conectado ao SAD (usando acesso padrão)'}
      </Text>

      {email ? (
        <TouchableOpacity style={styles.sadBtnOutline} onPress={desconectar} activeOpacity={0.8}>
          <Text style={styles.sadBtnOutlineText}>Desconectar</Text>
        </TouchableOpacity>
      ) : abrindo ? (
        <>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>E-mail do SAD</Text>
            <TextInput
              style={styles.input} placeholder="seu e-mail no SAD" placeholderTextColor={Colors.textSecondary}
              value={emailDigitado} onChangeText={setEmailDigitado}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Senha do SAD</Text>
            <TextInput
              style={styles.input} placeholder="senha" placeholderTextColor={Colors.textSecondary}
              value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" autoCorrect={false}
            />
          </View>
          {erro && <Text style={styles.sadErro}>{erro}</Text>}
          <TouchableOpacity style={styles.sadBtn} onPress={conectar} disabled={aguarde} activeOpacity={0.8}>
            {aguarde ? <ActivityIndicator color="#fff" /> : <Text style={styles.sadBtnText}>Conectar</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAbrindo(false); setErro(null); setSenha(''); }} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={styles.fieldLabel}>Cancelar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.sadBtn} onPress={() => setAbrindo(true)} activeOpacity={0.8}>
          <Text style={styles.sadBtnText}>Conectar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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

      <ConexaoSAD />

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

  sadStatus: { color: Colors.textPrimary, fontSize: 14, marginBottom: 12 },
  sadErro: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  sadBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  sadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sadBtnOutline: { borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  sadBtnOutlineText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
});
