// Types
export {
  type ToolSource,
  type McpToolSource,
  type BuiltinToolSource,
  type ToolExecutionContext,
  type ChildAgentConfig,
  type ToolDefinition,
  type ToolProvider,
  type ToolExecutionResult,
  type RegisteredTool,
  type ToolRegistryOptions,
  type ToolModule,
  type AnyToolModule,
  defineTool,
  defineToolModule,
} from "./types";

// Registry
export { ToolRegistry, getToolRegistry, resetToolRegistry } from "./registry";

// Providers
export { McpToolProvider, BuiltinToolProvider } from "./providers";

// Tool Modules (abstract tools that reference integrations)
export {
  allToolModules,
  getToolModule,
  getToolModuleByIntegration,
  tasksModule,
  notesModule,
  memoryModule,
} from "./modules";

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
import { McpToolProvider, BuiltinToolProvider } from "./providers";

let initialized = false;
let builtinProvider: BuiltinToolProvider | null = null;

/**
 * Initialize the global tool registry with default providers.
 * Call this once at application startup or before first use.
 */
export async function initializeToolRegistry(): Promise<void> {
  if (initialized) return;

  const registry = getToolRegistry();

  // Register MCP provider (external tools from MCP servers)
  const mcpProvider = new McpToolProvider();
  registry.registerProvider(mcpProvider);

  // Register builtin provider (tools from tool modules)
  builtinProvider = new BuiltinToolProvider();
  registry.registerProvider(builtinProvider);

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
 * Get the builtin provider to refresh tools.
 */
export function getBuiltinProvider(): BuiltinToolProvider | undefined {
  return builtinProvider || undefined;
}
