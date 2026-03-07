import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionStore } from "../ports.js";

export class FileSessionStore implements SessionStore {
  constructor(private dataDir: string = ".agents-data") {}

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
