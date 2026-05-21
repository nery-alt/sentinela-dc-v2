import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TIMEOUT_MS = 3000;

async function readLocalSession(): Promise<Session | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const key = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Session;
    if (!data?.access_token || !data?.expires_at) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (data.expires_at <= nowSec) return null;
    return data;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineNoSession, setOfflineNoSession] = useState(false);
  const isOfflineModeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const localSession = await readLocalSession();

      if (localSession) {
        // Valid non-expired session in storage — navigate immediately, no network call needed
        if (!cancelled) {
          setSession(localSession);
          setLoading(false);
        }
        // Sync online state in background without blocking
        supabase.auth.getSession()
          .then(({ data }) => {
            if (!cancelled && data.session) {
              isOfflineModeRef.current = false;
              setSession(data.session);
            }
          })
          .catch(() => {});
        return;
      }

      // No valid local session — try online with timeout
      const result = await Promise.race([
        supabase.auth.getSession()
          .then(r => ({ kind: 'done' as const, session: r.data.session }))
          .catch(() => ({ kind: 'done' as const, session: null as Session | null })),
        new Promise<{ kind: 'timeout' }>(resolve =>
          setTimeout(() => resolve({ kind: 'timeout' }), SESSION_TIMEOUT_MS)
        ),
      ]);

      if (cancelled) return;

      if (result.kind === 'timeout') {
        isOfflineModeRef.current = true;
        setOfflineNoSession(true);
        setLoading(false);
      } else {
        setSession(result.session);
        setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      // Ignore SIGNED_OUT fired by failed token refresh while offline
      if (event === 'SIGNED_OUT' && isOfflineModeRef.current) return;
      setSession(newSession);
      if (newSession) {
        isOfflineModeRef.current = false;
        setOfflineNoSession(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, offlineNoSession };
}
