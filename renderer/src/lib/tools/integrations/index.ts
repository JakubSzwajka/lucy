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

// ============================================================================
// All Integration Definitions
// ============================================================================

import type { IntegrationDefinition } from "./types";
import { todoistIntegration } from "./todoist";

/**
 * All available integration definitions.
 * Add new integrations here to make them available in the app.
 */
export const allIntegrations: IntegrationDefinition[] = [
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
