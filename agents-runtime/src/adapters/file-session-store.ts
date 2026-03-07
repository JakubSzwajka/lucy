import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionStore } from "../ports.js";
import type { Session } from "../types.js";

export class FileSessionStore implements SessionStore {
  constructor(private dataDir: string = ".agents-data") {}

  async create(session: { id: string; agentId: string }): Promise<void> {
    const dir = join(this.dataDir, "sessions", session.id);
    const filePath = join(dir, "session.json");
    await mkdir(dir, { recursive: true });

    const data: Session = {
      id: session.id,
      agentId: session.agentId,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async get(sessionId: string): Promise<Session | null> {
    const filePath = join(this.dataDir, "sessions", sessionId, "session.json");
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as Session;
    } catch {
      return null;
    }
  }

  async list(): Promise<Session[]> {
    const sessionsDir = join(this.dataDir, "sessions");
    let entries: string[];
    try {
      entries = await readdir(sessionsDir);
    } catch {
      return [];
    }

    const sessions: Session[] = [];
    for (const entry of entries) {
      const filePath = join(sessionsDir, entry, "session.json");
      try {
        const data = await readFile(filePath, "utf-8");
        sessions.push(JSON.parse(data) as Session);
      } catch {
        continue;
      }
    }

    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async touch(sessionId: string): Promise<void> {
    const dir = join(this.dataDir, "sessions", sessionId);
    const filePath = join(dir, "session.json");
    await mkdir(dir, { recursive: true });

    let session: Record<string, unknown> = { id: sessionId };
    try {
      const data = await readFile(filePath, "utf-8");
      session = JSON.parse(data);
    } catch {
      // File doesn't exist yet, use defaults
    }

    session.updatedAt = new Date().toISOString();
    await writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  }
}
