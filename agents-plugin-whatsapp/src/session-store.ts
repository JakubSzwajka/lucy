import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AgentRuntime } from "agents-runtime";

export class PhoneSessionStore {
  private readonly filePath: string;
  private readonly runtime: AgentRuntime;
  private mappings: Record<string, string> = {};

  constructor(runtime: AgentRuntime, dataDir: string) {
    this.runtime = runtime;
    this.filePath = join(dataDir, "whatsapp", "phone-sessions.json");
  }

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) {
      this.mappings = {};
      return;
    }
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.mappings = JSON.parse(raw);
    } catch {
      console.warn("Failed to parse phone-sessions.json, starting fresh");
      this.mappings = {};
    }
  }

  async getOrCreateSession(phoneNumber: string): Promise<string> {
    const existingSessionId = this.mappings[phoneNumber];
    if (existingSessionId) {
      const session = await this.runtime.getSession(existingSessionId);
      if (session) {
        return existingSessionId;
      }
    }

    const { sessionId } = await this.runtime.createSession({});
    this.mappings[phoneNumber] = sessionId;
    await this.persist();
    return sessionId;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.mappings, null, 2));
  }
}
