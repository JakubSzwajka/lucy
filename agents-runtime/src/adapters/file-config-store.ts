import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigStore } from "../ports.js";
import type { AgentConfigWithTools } from "../types.js";

export class FileConfigStore implements ConfigStore {
  constructor(private dataDir: string = ".agents-data") {}

  async getAgentConfig(configId: string): Promise<AgentConfigWithTools | null> {
    const filePath = join(this.dataDir, "config", "agent-config.json");
    try {
      const data = await readFile(filePath, "utf-8");
      const config = JSON.parse(data) as AgentConfigWithTools;
      return config.id === configId ? config : null;
    } catch {
      return null;
    }
  }

  async createAgentConfig(config: AgentConfigWithTools): Promise<AgentConfigWithTools> {
    const dir = join(this.dataDir, "config");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "agent-config.json"), JSON.stringify(config, null, 2), "utf-8");
    return config;
  }
}
