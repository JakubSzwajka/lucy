import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

function getDbPath(): string {
  // In production Electron, use LUCY_USER_DATA_PATH env var if set
  // This should be set by the main process
  if (process.env.LUCY_USER_DATA_PATH) {
    const userDataPath = process.env.LUCY_USER_DATA_PATH;
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, "lucy.db");
  }

  // In development or web mode, use project root
  return path.join(process.cwd(), "lucy.db");
}

const dbPath = getDbPath();
const MIGRATIONS_TABLE = "__drizzle_migrations";
const APP_TABLES = ["sessions", "agents", "items", "plans", "plan_steps"];

function getMigrationsPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "drizzle"),
    path.join(process.cwd(), "renderer", "drizzle"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Use globalThis to persist database connection across hot reloads
declare global {
  var _db: BetterSQLite3Database<typeof schema> | undefined;
  var _sqlite: ReturnType<typeof Database> | undefined;
  var _dbMigrated: boolean | undefined;
}

function getDb(): BetterSQLite3Database<typeof schema> {
  if (!globalThis._db) {
    console.log(`[DB] Connecting to database at: ${dbPath}`);
    const sqlite = new Database(dbPath);
    // Enable WAL mode for better concurrent performance
    sqlite.pragma("journal_mode = WAL");
    // Set busy timeout to wait for locks instead of failing immediately
    sqlite.pragma("busy_timeout = 5000");
    globalThis._sqlite = sqlite;
    const drizzleDb = drizzle(sqlite, { schema });

    if (!globalThis._dbMigrated) {
      const migrationsPath = getMigrationsPath();
      const hasMigrationsTable = tableExists(sqlite, MIGRATIONS_TABLE);
      const hasExistingAppSchema = APP_TABLES.some((tableName) => tableExists(sqlite, tableName));
      const hasAppliedMigrations = hasMigrationsTable
        ? hasMigrationRows(sqlite)
        : false;

      if (migrationsPath && (!hasExistingAppSchema || hasAppliedMigrations)) {
        migrate(drizzleDb, { migrationsFolder: migrationsPath });
        console.log(`[DB] Applied migrations from: ${migrationsPath}`);
      } else if (hasExistingAppSchema && !hasAppliedMigrations) {
        console.log("[DB] Existing schema detected without applied migrations. Skipping migrations.");
      } else {
        console.warn("[DB] No migrations directory found. Skipping migrations.");
      }
      globalThis._dbMigrated = true;
    }

    globalThis._db = drizzleDb;
  }
  return globalThis._db;
}

function tableExists(sqlite: ReturnType<typeof Database>, tableName: string): boolean {
  const result = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName);
  return Boolean(result);
}

function hasMigrationRows(sqlite: ReturnType<typeof Database>): boolean {
  const result = sqlite
    .prepare(`SELECT COUNT(*) as count FROM ${MIGRATIONS_TABLE}`)
    .get() as { count: number };
  return result.count > 0;
}

// Lazy proxy: only connect to SQLite when a property is actually accessed at runtime.
// This prevents SQLITE_BUSY errors during `next build` when multiple workers
// evaluate this module concurrently but never actually query the database.
export const db: BetterSQLite3Database<typeof schema> = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * from "./schema";
