import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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

// Use globalThis to persist database connection across hot reloads
declare global {
  var _db: BetterSQLite3Database<typeof schema> | undefined;
  var _sqlite: ReturnType<typeof Database> | undefined;
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
    globalThis._db = drizzle(sqlite, { schema });
  }
  return globalThis._db;
}

export const db = getDb();

export * from "./schema";
