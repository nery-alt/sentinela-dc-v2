import { useState, useEffect } from 'react';
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
    // Accept expired access_token — refresh_token is what matters for re-auth
    if (!data?.access_token || !data?.refresh_token) return null;
    return data;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineNoSession, setOfflineNoSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const localSession = await readLocalSession();

      if (localSession) {
        // Use local session immediately — WatermelonDB works offline regardless of token expiry
        if (!cancelled) {
          setSession(localSession);
          setLoading(false);
        }
        // Refresh token in background; if online this gives a fresh access_token
        supabase.auth.refreshSession()
          .then(({ data }) => {
            if (!cancelled && data.session) setSession(data.session);
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
      if (event === 'SIGNED_OUT') {
        // A failed background token refresh with no connection also fires
        // SIGNED_OUT — including from the Supabase client's own internal
        // auto-refresh, which starts the instant the client is created,
        // ahead of this effect. So don't trust the event alone: check disk
        // directly. An explicit "Sair" in Configurações clears the stored
        // token before this event fires, so if a token is still there, this
        // SIGNED_OUT was just a doomed offline refresh, not a real one.
        readLocalSession().then(stillThere => {
          if (cancelled) return;
          if (stillThere) return;
          setSession(null);
        });
        return;
      }
      setSession(newSession);
      if (newSession) setOfflineNoSession(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, offlineNoSession };
}
