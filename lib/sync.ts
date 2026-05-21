import AsyncStorage from '@react-native-async-storage/async-storage';
import { Q } from '@nozbe/watermelondb';
import { database } from './database';
import { supabase } from './supabase';

const LAST_SYNC_KEY = '@sentinela:lastSync';
const TABLES = ['cadastros', 'vistorias', 'vistorias_tecnicas'] as const;

async function getLastSync(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return val ? Number(val) : 0;
  } catch {
    return 0;
  }
}

export async function saveLastSync(ts: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(ts));
}

// Reset sincronizado = false for records marked synced locally but absent from Supabase
async function repairTable(tableName: string): Promise<void> {
  const collection = database.collections.get(tableName);
  const synced = await collection
    .query(Q.where('sincronizado', Q.eq(true)), Q.where('rascunho', Q.eq(false)))
    .fetch();

  if (synced.length === 0) return;

  const localIds = synced.map(r => r.id);
  const { data, error } = await supabase.from(tableName).select('id').in('id', localIds);

  if (error) {
    console.error(`[sync] repairTable ${tableName}:`, error.message);
    return;
  }

  const remoteIds = new Set((data ?? []).map((r: any) => r.id));
  const toReset = synced.filter(r => !remoteIds.has(r.id));

  if (toReset.length === 0) return;

  console.error(`[sync] repairTable ${tableName}: resetting ${toReset.length} record(s) not found in Supabase`);

  await database.write(async () => {
    for (const record of toReset) {
      await (record as any).update((r: any) => {
        r.sincronizado = false;
      });
    }
  });
}

async function uploadTable(tableName: string): Promise<void> {
  const collection = database.collections.get(tableName);
  const pending = await collection
    .query(Q.where('sincronizado', Q.eq(false)), Q.where('rascunho', Q.eq(false)))
    .fetch();

  if (pending.length === 0) return;

  const rows = pending.map(record => {
    const raw: any = { ...record._raw };
    delete raw._status;
    delete raw._changed;
    raw.sincronizado = true;
    return raw;
  });

  const { error: upsertError } = await supabase
    .from(tableName)
    .upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    throw new Error(`[sync] uploadTable ${tableName}: ${upsertError.message}`);
  }

  // Confirm which IDs were actually saved in Supabase
  const sentIds = rows.map(r => r.id);
  const { data: confirmed, error: verifyError } = await supabase
    .from(tableName)
    .select('id')
    .in('id', sentIds);

  if (verifyError) {
    throw new Error(`[sync] verifyTable ${tableName}: ${verifyError.message}`);
  }

  const confirmedIds = new Set((confirmed ?? []).map((r: any) => r.id));
  const toMark = pending.filter(r => confirmedIds.has(r.id));

  if (toMark.length === 0) {
    console.error(`[sync] uploadTable ${tableName}: upsert did not save any rows (RLS may be blocking)`);
    return;
  }

  await database.write(async () => {
    for (const record of toMark) {
      await (record as any).update((r: any) => {
        r.sincronizado = true;
        r.updated_at = Date.now();
      });
    }
  });
}

async function downloadTable(tableName: string, since: number): Promise<void> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .gt('updated_at', since);

  if (error) throw new Error(`[sync] downloadTable ${tableName}: ${error.message}`);
  if (!data || data.length === 0) return;

  const collection = database.collections.get(tableName);
  const ids = data.map((r: any) => r.id);
  const existingRecords = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();
  const existingMap = new Map(existingRecords.map(r => [r.id, r]));

  await database.write(async () => {
    for (const remote of data) {
      const existing = existingMap.get(remote.id);
      if (existing) {
        await (existing as any).update((r: any) => {
          Object.entries(remote).forEach(([key, value]) => {
            if (key !== 'id') (r._raw as any)[key] = value;
          });
          r.sincronizado = true;
        });
      } else {
        await collection.create((r: any) => {
          Object.entries(remote).forEach(([key, value]) => {
            (r._raw as any)[key] = value;
          });
          r.sincronizado = true;
        });
      }
    }
  });
}

export async function syncAll(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const since = await getLastSync();
  const now = Date.now();

  for (const table of TABLES) {
    await repairTable(table);
    await uploadTable(table);
    await downloadTable(table, since);
  }

  await saveLastSync(now);
}
