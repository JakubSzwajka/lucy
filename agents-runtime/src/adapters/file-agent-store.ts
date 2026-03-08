import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentStore } from "../ports.js";
import type { Agent, AgentUpdate } from "../types.js";

export class FileAgentStore implements AgentStore {
  constructor(private dataDir: string = ".agents-data") {}

  async create(agent: Agent): Promise<Agent> {
    const filePath = join(this.dataDir, "agent.json");
    await writeFile(filePath, JSON.stringify(agent, null, 2), "utf-8");
    return agent;
  }

  async getById(agentId: string): Promise<Agent | null> {
    const filePath = join(this.dataDir, "agent.json");
    try {
      const data = await readFile(filePath, "utf-8");
      const agent = JSON.parse(data) as Agent;
      return agent.id === agentId ? agent : null;
    } catch {
      return null;
    }
  }

  async update(agentId: string, update: AgentUpdate): Promise<void> {
    const existing = await this.getById(agentId);
    if (!existing) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const updated = { ...existing, ...update };
    await writeFile(join(this.dataDir, "agent.json"), JSON.stringify(updated, null, 2), "utf-8");
  }
}
