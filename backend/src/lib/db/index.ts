import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const provider = process.env.DATABASE_PROVIDER || "sqlite";

function createSqliteDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const dbPath = process.env.LUCY_USER_DATA_PATH
    ? `${process.env.LUCY_USER_DATA_PATH}/lucy.db`
    : `${process.cwd()}/lucy.db`;

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  return drizzleSqlite(sqlite, { schema });
}

function createPostgresDb() {
  // Dynamic import to avoid requiring pg when using sqlite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return drizzlePg(pool, { schema });
}

// Global singleton for hot reload persistence
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createSqliteDb> | ReturnType<typeof createPostgresDb> | undefined;
};

export const db = globalForDb.db ?? (provider === "postgres" ? createPostgresDb() : createSqliteDb());

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
