import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Cadastro } from './models/Cadastro';
import { Vistoria } from './models/Vistoria';
import { VistoriaTecnica } from './models/VistoriaTecnica';

const adapter = new SQLiteAdapter({ schema, dbName: 'sentinela_dc_v2' });

export const database = new Database({
  adapter,
  modelClasses: [Cadastro, Vistoria, VistoriaTecnica],
});
