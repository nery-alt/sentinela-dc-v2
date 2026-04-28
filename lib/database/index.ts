import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { Cadastro } from './models/Cadastro';
import { Vistoria } from './models/Vistoria';
import { VistoriaTecnica } from './models/VistoriaTecnica';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'sentinela_dc_v2',
  onSetUpError: error => {
    console.error('Database setup error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [Cadastro, Vistoria, VistoriaTecnica],
});
