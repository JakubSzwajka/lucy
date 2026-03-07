import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentStore } from "../ports.js";
import type { Agent, AgentUpdate } from "../types.js";

export class FileAgentStore implements AgentStore {
  constructor(private dataDir: string = ".agents-data") {}

  async getById(agentId: string): Promise<Agent | null> {
    const filePath = join(this.dataDir, "agents", `${agentId}.json`);
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as Agent;
    } catch {
      return null;
    }
  }

  async update(agentId: string, update: AgentUpdate): Promise<void> {
    const filePath = join(this.dataDir, "agents", `${agentId}.json`);
    const existing = await this.getById(agentId);
    if (!existing) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const updated = { ...existing, ...update };
    await mkdir(join(this.dataDir, "agents"), { recursive: true });
    await writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
  }
}
