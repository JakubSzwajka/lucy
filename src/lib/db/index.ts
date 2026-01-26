import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbPath = path.join(process.cwd(), "lucy.db");

// Use globalThis to persist database connection across hot reloads
declare global {
  var _db: BetterSQLite3Database<typeof schema> | undefined;
  var _sqlite: ReturnType<typeof Database> | undefined;
}

function getDb(): BetterSQLite3Database<typeof schema> {
  if (!globalThis._db) {
    const sqlite = new Database(dbPath);
    // Enable WAL mode for better concurrent performance
    sqlite.pragma("journal_mode = WAL");
    // Set busy timeout to wait for locks instead of failing immediately
    sqlite.pragma("busy_timeout = 5000");
    globalThis._sqlite = sqlite;
    globalThis._db = drizzle(sqlite, { schema });
  }
  return globalThis._db;
}

export const db = getDb();

export * from "./schema";
