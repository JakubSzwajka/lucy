// Types
export {
  type ToolSource,
  type McpToolSource,
  type BuiltinToolSource,
  type AgentToolSource,
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
export { McpToolProvider, BuiltinToolProvider } from "./providers";

// Builtin tools
export { builtinTools, BUILTIN_CATEGORIES, type BuiltinCategory } from "./builtin";

// Integrations
export {
  type IntegrationDefinition,
  type IntegrationState,
  type IntegrationWithState,
  defineIntegration,
  IntegrationToolProvider,
  allIntegrations,
  getIntegrationDefinition,
} from "./integrations";

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
import { McpToolProvider } from "./providers/mcp";
import { BuiltinToolProvider } from "./providers/builtin";
import { builtinTools } from "./builtin";
import { IntegrationToolProvider, allIntegrations } from "./integrations";

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

  // Register builtin provider with default tools
  const builtinProvider = new BuiltinToolProvider(builtinTools);
  registry.registerProvider(builtinProvider);

  // Register integration provider with all defined integrations
  const integrationProvider = new IntegrationToolProvider(allIntegrations);
  registry.registerProvider(integrationProvider);

  // Initialize all providers
  await registry.initialize();

  initialized = true;
}

/**
 * Get the builtin provider to add custom tools at runtime.
 */
export function getBuiltinProvider(): BuiltinToolProvider | undefined {
  const registry = getToolRegistry();
  return registry.getProvider("builtin") as BuiltinToolProvider | undefined;
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
