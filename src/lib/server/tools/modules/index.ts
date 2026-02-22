/**
 * Tool Modules
 *
 * Abstract tool modules that use integrations for their backends.
 *
 * Each module:
 * - Has an abstract ID (e.g., "continuity", "plan")
 * - References an integration by ID
 * - Creates tools that receive a client from the integration
 */

import type { AnyToolModule } from "../types";
import { continuityModule } from "./continuity";
import { planModule } from "./plan";

// Re-export individual modules
export { continuityModule } from "./continuity";
export { planModule } from "./plan";

/**
 * All available tool modules.
 *
 * To add a new tool module:
 * 1. Create a new directory under modules/
 * 2. Export a ToolModule from index.ts
 * 3. Add it to this array
 */
export const allToolModules: AnyToolModule[] = [
  continuityModule,
  planModule,
];

/**
 * Get a tool module by ID.
 */
export function getToolModule(id: string): AnyToolModule | undefined {
  return allToolModules.find((m) => m.id === id);
}

/**
 * Get a tool module by its integration ID.
 * Returns the first module that uses the given integration.
 */
export function getToolModuleByIntegration(integrationId: string): AnyToolModule | undefined {
  return allToolModules.find((m) => m.integrationId !== null && m.integrationId === integrationId);
}

/**
 * Get all tool modules that use a given integration.
 * Returns all modules that reference the integration ID.
 */
export function getToolModulesByIntegration(integrationId: string): AnyToolModule[] {
  return allToolModules.filter((m) => m.integrationId !== null && m.integrationId === integrationId);
}
