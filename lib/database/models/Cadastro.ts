import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class Cadastro extends Model {
  static table = 'cadastros';

  @field('nome') nome!: string;
  @field('cpf') cpf!: string;
  @field('rascunho') rascunho!: boolean;
  @field('sincronizado') sincronizado!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
