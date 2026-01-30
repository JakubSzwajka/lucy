// Types
export {
  type IntegrationDefinition,
  type IntegrationState,
  type IntegrationWithState,
  defineIntegration,
} from "./types";

// Provider
export { IntegrationToolProvider } from "./provider";

// Individual integrations
export { todoistIntegration } from "./todoist";
export { knowledgeIntegration } from "./knowledge";

// ============================================================================
// All Integration Definitions
// ============================================================================

import type { IntegrationDefinition } from "./types";
import { todoistIntegration } from "./todoist";
import { knowledgeIntegration } from "./knowledge";

/**
 * All available integration definitions.
 *
 * The "knowledge" integration provides unified entity management:
 * - Facts (quick key-value info, replaces "memory")
 * - Notes (longer documents, replaces "notes")
 * - Named entities (people, places, organizations, etc.)
 *
 * All data lives in memory/entities/ as YAML files.
 */
export const allIntegrations: IntegrationDefinition[] = [
  knowledgeIntegration,
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
