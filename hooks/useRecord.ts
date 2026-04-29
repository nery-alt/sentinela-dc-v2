import { useState, useEffect } from 'react';
import { database } from '../lib/database';

export function useCollection(tableName: string) {
  const [records, setRecords] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const subscription = database.collections
      .get(tableName)
      .query()
      .observeWithColumns(['updated_at'])
      .subscribe((r: any[]) => {
        setRecords(r.map(rec => rec));
        setTick(t => t + 1);
      });
    return () => subscription.unsubscribe();
  }, [tableName]);

  return { records, tick };
}

export function useRecord(tableName: string, id: string | undefined) {
  const [record, setRecord] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    const subscription = database.collections
      .get(tableName)
      .findAndObserve(id)
      .subscribe({
        next: (r: any) => {
          setRecord(r);
          setTick(t => t + 1);
        },
        error: () => setRecord(null),
      });
    return () => subscription.unsubscribe();
  }, [tableName, id]);

  return { record, tick };
}
