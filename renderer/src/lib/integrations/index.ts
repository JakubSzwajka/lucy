// Types
export {
  type IntegrationDefinition,
  type IntegrationState,
  type IntegrationWithState,
  defineIntegration,
} from "./types";

// Individual integrations
export { filesystemIntegration } from "./filesystem";
export { obsidianIntegration } from "./obsidian";
export { todoistIntegration } from "./todoist";

// ============================================================================
// All Integration Definitions
// ============================================================================

import type { IntegrationDefinition } from "./types";
import { filesystemIntegration } from "./filesystem";
import { obsidianIntegration } from "./obsidian";
import { todoistIntegration } from "./todoist";

/**
 * All available integration definitions.
 *
 * - filesystem: Local file storage (always available)
 * - obsidian: Notes via Obsidian Local REST API (requires plugin)
 * - todoist: Task management via Todoist API
 */
export const allIntegrations: IntegrationDefinition[] = [
  filesystemIntegration,
  obsidianIntegration,
  todoistIntegration,
];

/**
 * Get an integration definition by ID.
 */
export function getIntegrationDefinition(
  id: string
): IntegrationDefinition | undefined {
  return allIntegrations.find((i) => i.id === id);
}
