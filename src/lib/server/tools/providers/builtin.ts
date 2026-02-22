/**
 * Builtin Tool Provider
 *
 * Loads tools from all registered tool modules.
 * Each module creates its own tools internally (no integration indirection).
 */

import type { ToolProvider, ToolDefinition, AnyToolModule } from "../types";
import { allToolModules } from "../modules";

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

  /**
   * Get all available tool modules.
   */
  getModules(): AnyToolModule[] {
    return [...allToolModules];
  }

  /**
   * Get a specific tool module by ID.
   */
  getModule(id: string): AnyToolModule | undefined {
    return allToolModules.find((m) => m.id === id);
  }

  /**
   * Refresh tools from all registered modules.
   */
  async refresh(): Promise<void> {
    this.tools = [];

    for (const toolModule of allToolModules) {
      try {
        const moduleTools = toolModule.createTools(null);
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
