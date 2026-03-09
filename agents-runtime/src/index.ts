export {
  AgentRuntime,
  cancelAgent,
} from "./runtime/agent-runtime.js";
export { createFileAdapters } from "./adapters/index.js";
export { OpenRouterModelProvider } from "./adapters/openrouter-model-provider.js";
export { resolveDataDir } from "./adapters/resolve-data-dir.js";
export { loadConfig } from "./config/load-config.js";
export { loadPlugins } from "./plugins/loader.js";

// Re-export types
export type { GatewayAuthConfig, GatewayHttpConfig, LucyConfig, PluginEntry } from "./config/types.js";
export type { LoadedPlugins } from "./plugins/loader.js";
export type {
  Agent,
  AgentConfig,
  AgentConfigTool,
  AgentConfigWithTools,
  AgentRuntimeOptions,
  AgentUpdate,
  ChatContext,
  CompactionConfig,
  DualPluginManifest,
  GatewayPlugin,
  GatewayPluginConfig,
  GatewayPluginInitInput,
  GatewayPluginManifest,
  IdentityDocument,
  Item,
  MessageItem,
  ModelConfig,
  ModelMessage,
  ModelMessageContent,
  PluginManifest,
  PluginType,
  ReasoningItem,
  ResolvedGatewayPlugin,
  ResolvedRuntimePlugin,
  RunOptions,
  RunResult,
  RuntimeConfig,
  RuntimeDeps,
  RuntimePlugin,
  RuntimePluginConfig,
  RuntimePluginInitInput,
  RuntimePluginManifest,
  RuntimePluginPrepareContextInput,
  RuntimePluginPrepareContextResult,
  RuntimePluginRunCompleteInput,
  RuntimePluginRunSummary,
  RuntimePluginSystemPromptSection,
  ToolCallItem,
  ToolResultItem,
} from "./types.js";

export type {
  AgentStore,
  ConfigStore,
  IdentityProvider,
  ItemStore,
  ModelProvider,
} from "./ports.js";
