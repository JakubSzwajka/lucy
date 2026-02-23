// Types
export {
  type ToolSource,
  type McpToolSource,
  type BuiltinToolSource,
  type DelegateToolSource,
  type ToolExecutionContext,
  type ToolDefinition,
  type ToolProvider,
  type ToolExecutionResult,
  type RegisteredTool,
  type ToolRegistryOptions,
  type ToolFilter,
  type ToolModule,
  defineTool,
  defineToolModule,
} from "./types";

// Registry
export { ToolRegistry, getToolRegistry } from "./registry";

// Providers
export { McpToolProvider } from "./mcp-provider";
export { BuiltinToolProvider } from "./builtin-provider";

// Tool Modules
export {
  allToolModules,
  getToolModule,
} from "./builtin";

// Delegate Tools
export { generateDelegateTools } from "./builtin/delegate";

// ============================================================================
// Registry Initialization
// ============================================================================

import { getToolRegistry } from "./registry";
import { McpToolProvider } from "./mcp-provider";
import { BuiltinToolProvider } from "./builtin-provider";

let initialized = false;
let builtinProvider: BuiltinToolProvider | null = null;

export async function initializeToolRegistry(): Promise<void> {
  if (initialized) return;

  const registry = getToolRegistry();

  const mcpProvider = new McpToolProvider();
  registry.registerProvider(mcpProvider);

  builtinProvider = new BuiltinToolProvider();
  registry.registerProvider(builtinProvider);

  await registry.initialize();

  initialized = true;
}

export function getMcpProvider(): McpToolProvider | undefined {
  const registry = getToolRegistry();
  return registry.getProvider("mcp") as McpToolProvider | undefined;
}

export function getBuiltinProvider(): BuiltinToolProvider | undefined {
  return builtinProvider || undefined;
}
