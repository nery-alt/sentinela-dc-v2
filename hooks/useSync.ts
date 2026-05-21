import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAll } from '../lib/sync';

const LAST_SYNC_KEY = '@sentinela:lastSync';

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      await syncAll();
      const ts = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (ts) setLastSync(new Date(Number(ts)));
    } catch (e) {
      console.error('[sync] syncAll failed:', e);
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [run]);

  return { syncing, lastSync };
}
