import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env';

enum DbType {
  postgres = 'postgres',
  mysql = 'mysql',
  sqlite = 'sqlite',
}

export const config: { [keyof: string]: DataSourceOptions } = {
  development: {
    type: DbType.postgres,
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'lucy',
    migrationsTableName: 'migrations',
    migrations: ['dist/src/migrations/*.js'],
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
  },
  production: {
    type: DbType.postgres,
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT, 10),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    migrationsTableName: 'migrations',
    migrations: ['dist/src/migrations/*.js'],
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    ssl: {
      ca: env.DB_CA_CERT,
    },
  },
};

console.log('Using config', config[env.NODE_ENV]);

export default new DataSource(config[env.NODE_ENV]);
