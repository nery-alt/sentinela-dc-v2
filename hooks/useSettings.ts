import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = '@sentinela:settings';

export interface AppSettings {
  nomeVistoriador: string;
  matricula: string;
  cargo: string;
  nomeSecretaria: string;
  municipioUF: string;
}

const defaults: AppSettings = {
  nomeVistoriador: '',
  matricula: '',
  cargo: '',
  nomeSecretaria: '',
  municipioUF: '',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (json) return { ...defaults, ...JSON.parse(json) };
  } catch {}
  return { ...defaults };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({ ...defaults });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoaded(true); });
  }, []);

  const save = useCallback(async (next: AppSettings) => {
    await saveSettings(next);
    setSettings(next);
  }, []);

  return { settings, loaded, save };
}
