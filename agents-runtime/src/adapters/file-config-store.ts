import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigStore } from "../ports.js";
import type { AgentConfigWithTools, SystemPrompt } from "../types.js";

export class FileConfigStore implements ConfigStore {
  constructor(private dataDir: string = ".agents-data") {}

  async getAgentConfig(configId: string): Promise<AgentConfigWithTools | null> {
    const filePath = join(this.dataDir, "config", "agents", `${configId}.json`);
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as AgentConfigWithTools;
    } catch {
      return null;
    }
  }

  async getSystemPrompt(promptId: string): Promise<SystemPrompt | null> {
    const filePath = join(this.dataDir, "config", "prompts", `${promptId}.json`);
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as SystemPrompt;
    } catch {
      return null;
    }
  }
}
