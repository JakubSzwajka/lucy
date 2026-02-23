import type { ToolProvider, ToolDefinition, ToolModule } from "./types";
import { allToolModules } from "./builtin";

export class BuiltinToolProvider implements ToolProvider {
  readonly name = "builtin";
  private tools: ToolDefinition[] = [];

  async getTools(filter?: { allowedModuleIds?: string[] }): Promise<ToolDefinition[]> {
    if (filter?.allowedModuleIds) {
      return this.tools.filter(
        (t) => t.source.type === "builtin" && filter.allowedModuleIds!.includes(t.source.moduleId)
      );
    }
    return this.tools;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async initialize(): Promise<void> {
    await this.refresh();
  }

  async dispose(): Promise<void> {
    this.tools = [];
  }

  getModules(): ToolModule[] {
    return [...allToolModules];
  }

  getModule(id: string): ToolModule | undefined {
    return allToolModules.find((m) => m.id === id);
  }

  async refresh(): Promise<void> {
    this.tools = [];

    for (const toolModule of allToolModules) {
      try {
        const moduleTools = toolModule.createTools();
        this.tools.push(...moduleTools);

        console.log(
          `[Tools] Loaded ${moduleTools.length} from ${toolModule.name}`
        );
      } catch (error) {
        console.error(`[Tools] Failed to initialize module ${toolModule.id}:`, error);
      }
    }
  }
}
