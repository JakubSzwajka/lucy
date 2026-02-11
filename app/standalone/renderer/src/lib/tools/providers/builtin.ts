/**
 * Builtin Tool Provider
 *
 * Loads tools from configured integrations.
 * Integrations are configured via environment variables.
 *
 * Flow:
 * 1. Loop through all integrations
 * 2. For each configured integration, find the tool module that uses it
 * 3. Create a client using the integration's createClient factory
 * 4. Pass the client to the tool module's createTools factory
 */

import type { ToolProvider, ToolDefinition, AnyToolModule } from "../types";
import { allToolModules, getToolModulesByIntegration } from "../modules";
import { allIntegrations, getIntegration, type AnyIntegration } from "@/lib/integrations";

export class BuiltinToolProvider implements ToolProvider {
  readonly name = "builtin";
  private tools: ToolDefinition[] = [];

  async getTools(): Promise<ToolDefinition[]> {
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
   * Get all available integrations.
   */
  getIntegrations(): AnyIntegration[] {
    return [...allIntegrations];
  }

  /**
   * Get a specific integration by ID.
   */
  getIntegration(id: string): AnyIntegration | undefined {
    return getIntegration(id);
  }

  /**
   * Refresh tools from configured integrations.
   */
  async refresh(): Promise<void> {
    this.tools = [];

    for (const integration of allIntegrations) {
      // Skip unconfigured integrations
      if (!integration.isConfigured()) {
        continue;
      }

      // Find all tool modules that use this integration
      const toolModules = getToolModulesByIntegration(integration.id);
      if (toolModules.length === 0) {
        console.warn(`[Tools] No module found for integration ${integration.id}`);
        continue;
      }

      try {
        // Create client using integration's factory
        const client = integration.createClient();
        if (!client) {
          console.warn(`[Tools] Integration ${integration.id} returned null client`);
          continue;
        }

        // Create tools from all modules that use this integration
        for (const toolModule of toolModules) {
          const moduleTools = toolModule.createTools(client);
          this.tools.push(...moduleTools);

          console.log(
            `[Tools] Loaded ${moduleTools.length} from ${toolModule.name} (via ${integration.name})`
          );
        }
      } catch (error) {
        console.error(`[Tools] Failed to initialize integration ${integration.id}:`, error);
      }
    }
  }
}
