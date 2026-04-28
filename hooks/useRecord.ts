import { useState, useEffect } from 'react';
import { database } from '../lib/database';

export function useCollection(tableName: string) {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const subscription = database.collections
      .get(tableName)
      .query()
      .observe()
      .subscribe((r: any[]) => setRecords(r));
    return () => subscription.unsubscribe();
  }, [tableName]);

  return records;
}

export function useRecord(tableName: string, id: string | undefined) {
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const subscription = database.collections
      .get(tableName)
      .findAndObserve(id)
      .subscribe({
        next: (r: any) => setRecord(r),
        error: () => setRecord(null),
      });
    return () => subscription.unsubscribe();
  }, [tableName, id]);

  return record;
}
