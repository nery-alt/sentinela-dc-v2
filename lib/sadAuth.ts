// Login no SAD — segundo cliente Supabase, só para o SAD.
// Separado do login do Sentinela (storageKey próprio). Opcional: sem login,
// o app continua usando a chave pública do SAD (ver fetchSAD em sadApi.ts).
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { SAD_URL, SAD_KEY } from './sadConfig';

const STORAGE_KEY = 'sentinela-sad-auth';

const sad = createClient(SAD_URL, SAD_KEY, {
  auth: {
    storage: AsyncStorage,
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native: só renovar o token automaticamente com o app em primeiro plano.
function aoMudarEstado(estado: AppStateStatus) {
  if (estado === 'active') sad.auth.startAutoRefresh();
  else sad.auth.stopAutoRefresh();
}
aoMudarEstado(AppState.currentState);
AppState.addEventListener('change', aoMudarEstado);

// Nunca deixar o envio esperando o login do SAD: se demorar, segue sem ele.
const LIMITE_MS = 4000;
function comLimite<T>(p: Promise<T>): Promise<T | null> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(null), LIMITE_MS);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

async function sessaoValida() {
  try {
    const r = await comLimite(sad.auth.getSession());
    const s = r?.data?.session;
    if (!s?.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function semInternet(e: { name?: string; message?: string; status?: number }): boolean {
  const msg = (e.message || '').toLowerCase();
  return e.name === 'AuthRetryableFetchError'
    || msg.includes('network request failed')
    || msg.includes('failed to fetch')
    || msg.includes('network');
}

export async function entrarNoSAD(email: string, senha: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { error } = await sad.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (!error) return { ok: true };
    if (semInternet(error)) return { ok: false, erro: 'Sem internet. Conecte quando tiver sinal.' };
    const code = (error as { code?: string }).code;
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
      return { ok: false, erro: 'E-mail ou senha do SAD incorretos.' };
    }
    if (code === 'email_not_confirmed') {
      return { ok: false, erro: 'Este e-mail ainda não foi confirmado no SAD.' };
    }
    return { ok: false, erro: `Não foi possível conectar ao SAD: ${error.message}` };
  } catch (e: any) {
    if (semInternet(e ?? {})) return { ok: false, erro: 'Sem internet. Conecte quando tiver sinal.' };
    return { ok: false, erro: 'Não foi possível conectar ao SAD. Tente novamente.' };
  }
}

export async function sairDoSAD(): Promise<void> {
  try {
    // scope 'local': apaga a sessão do celular mesmo sem internet.
    await sad.auth.signOut({ scope: 'local' });
  } catch {}
}

// E-mail da sessão guardada no celular (mesmo vencida / offline), ou null.
// Lê direto do armazenamento para não depender de renovar o token.
export async function emailSAD(): Promise<string | null> {
  try {
    const bruto = await AsyncStorage.getItem(STORAGE_KEY);
    if (!bruto) return null;
    return JSON.parse(bruto)?.user?.email ?? null;
  } catch {
    return null;
  }
}

// access_token válido do login do SAD, ou null. Nunca lança, nunca trava (limite de 4 s).
export async function tokenSAD(): Promise<string | null> {
  const s = await sessaoValida();
  return s?.access_token ?? null;
}
