import { mkdir, readFile, writeFile } from "node:fs/promises";
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

  async createAgentConfig(config: AgentConfigWithTools): Promise<AgentConfigWithTools> {
    const dir = join(this.dataDir, "config", "agents");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${config.id}.json`);
    await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
    return config;
  }

  async createSystemPrompt(prompt: SystemPrompt): Promise<SystemPrompt> {
    const dir = join(this.dataDir, "config", "prompts");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${prompt.id}.json`);
    await writeFile(filePath, JSON.stringify(prompt, null, 2), "utf-8");
    return prompt;
  }
}
