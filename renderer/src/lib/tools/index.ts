// Types
export {
  type ToolSource,
  type McpToolSource,
  type IntegrationToolSource,
  type ToolExecutionContext,
  type ChildAgentConfig,
  type ToolDefinition,
  type ToolProvider,
  type ToolExecutionResult,
  type RegisteredTool,
  type ToolRegistryOptions,
  defineTool,
} from "./types";

// Registry
export { ToolRegistry, getToolRegistry, resetToolRegistry } from "./registry";

// Providers
export { McpToolProvider, IntegrationToolProvider } from "./providers";

// Persistence utilities
export {
  insertItem,
  saveToolCall,
  saveToolResult,
  updateToolCallStatus,
} from "./utils/persistence";

// ============================================================================
// Registry Initialization
// ============================================================================

import { getToolRegistry } from "./registry";
import { McpToolProvider, IntegrationToolProvider } from "./providers";
import { allIntegrations } from "@/lib/integrations";

let initialized = false;

/**
 * Initialize the global tool registry with default providers.
 * Call this once at application startup or before first use.
 */
export async function initializeToolRegistry(): Promise<void> {
  if (initialized) return;

  const registry = getToolRegistry();

  // Register MCP provider
  const mcpProvider = new McpToolProvider();
  registry.registerProvider(mcpProvider);

  // Register integration provider with all defined integrations
  const integrationProvider = new IntegrationToolProvider(allIntegrations);
  registry.registerProvider(integrationProvider);

  // Initialize all providers
  await registry.initialize();

  initialized = true;
}

/**
 * Get the MCP provider to refresh servers.
 */
export function getMcpProvider(): McpToolProvider | undefined {
  const registry = getToolRegistry();
  return registry.getProvider("mcp") as McpToolProvider | undefined;
}

/**
 * Get the integration provider to refresh integrations.
 */
export function getIntegrationProvider(): IntegrationToolProvider | undefined {
  const registry = getToolRegistry();
  return registry.getProvider("integration") as IntegrationToolProvider | undefined;
}
