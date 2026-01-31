/**
 * Tool Modules
 *
 * Abstract tool modules that use integrations for their backends.
 *
 * Each module:
 * - Has an abstract ID (e.g., "tasks", "notes", "files")
 * - References an integration by ID
 * - Creates tools that receive a client from the integration
 */

import type { AnyToolModule } from "../types";
import { tasksModule } from "./tasks";
import { notesModule } from "./notes";

// Re-export individual modules
export { tasksModule } from "./tasks";
export { notesModule } from "./notes";

/**
 * All available tool modules.
 *
 * To add a new tool module:
 * 1. Create a new directory under modules/
 * 2. Export a ToolModule from index.ts
 * 3. Add it to this array
 */
export const allToolModules: AnyToolModule[] = [
  tasksModule,
  notesModule,
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
  return allToolModules.find((m) => m.integrationId === integrationId);
}
