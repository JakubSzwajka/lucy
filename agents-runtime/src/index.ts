export {
  AgentRuntime,
  cancelAgent,
} from "./runtime/agent-runtime.js";
export { createFileAdapters } from "./adapters/index.js";
export { OpenRouterModelProvider } from "./adapters/openrouter-model-provider.js";
export { resolveDataDir } from "./adapters/resolve-data-dir.js";
export {
  bootstrapAgentRuntime,
  createConfiguredRuntime,
} from "./plugins/bootstrap.js";
export { resolveRuntimePlugins } from "./plugins/registry.js";

// Re-export types
export type {
  Agent,
  AgentConfig,
  AgentConfigTool,
  AgentConfigWithTools,
  AgentRuntimeOptions,
  AgentUpdate,
  BootstrapAgentRuntimeOptions,
  ChatContext,
  IdentityDocument,
  Item,
  MessageItem,
  ModelConfig,
  ModelMessage,
  ModelMessageContent,
  ReasoningItem,
  ResolvedRuntimePlugin,
  RunOptions,
  RunResult,
  RuntimeDeps,
  RuntimeConfig,
  RuntimePlugin,
  RuntimePluginConfig,
  RuntimePluginRegistry,
  RuntimePluginInitInput,
  RuntimePluginPrepareContextInput,
  RuntimePluginPrepareContextResult,
  RuntimePluginRunCompleteInput,
  RuntimePluginRunSummary,
  RuntimePluginSystemPromptSection,
  RuntimePluginsConfig,
  Session,
  SystemPrompt,
  ToolCallItem,
  ToolResultItem,
} from "./types.js";

export type {
  AgentStore,
  ConfigStore,
  IdentityProvider,
  ItemStore,
  ModelProvider,
  SessionStore,
} from "./ports.js";
