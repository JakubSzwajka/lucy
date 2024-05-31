import { DataSource } from 'typeorm';
import { env } from './env';

enum DbType {
  mysql = 'mysql',
  sqlite = 'sqlite',
}

export const config = {
  development: {
    type: DbType.sqlite,
    database: 'db.sqlite',
    migrationsTableName: 'migrations',
    migrations: ['dist/src/migrations/*.js'],
    entities: [__dirname + '/**/*.entity.ts'],
  },
  production: {
    type: DbType.mysql,
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT, 10),
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    migrationsTableName: 'migrations',
    migrations: ['dist/src/migrations/*.js'],
    entities: [__dirname + '/**/*.entity.ts'],
  },
};

export default new DataSource(config[env.NODE_ENV]);
