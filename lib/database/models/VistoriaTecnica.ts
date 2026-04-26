import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class VistoriaTecnica extends Model {
  static table = 'vistorias_tecnicas';

  @field('nome_estabelecimento') nomeEstabelecimento!: string;
  @field('rascunho') rascunho!: boolean;
  @field('sincronizado') sincronizado!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
