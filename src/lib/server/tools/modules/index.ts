/**
 * Tool Modules
 *
 * Each module creates its own tools directly (no integration indirection).
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
