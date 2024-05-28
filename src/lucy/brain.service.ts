import Knex from 'knex';
import { Model } from 'objection';
import { env } from 'src/env';
import config from '../../knexfile';

const knex = Knex(config[env.NODE_ENV]);

Model.knex(knex);

export class Message extends Model {
  static get tableName() {
    return 'messages';
  }
}
