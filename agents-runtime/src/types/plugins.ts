import type {
  Agent,
  ModelConfig,
} from "./domain.js";
import type { RuntimeDeps } from "./runtime.js";

export interface RuntimePluginSystemPromptSection {
  content: string;
  key: string;
  title?: string;
}

export interface RuntimePluginInitInput<TConfig = unknown> {
  deps: RuntimeDeps;
  pluginConfig: TConfig;
}

export interface RuntimePluginPrepareContextInput<TConfig = unknown> {
  agent: Agent;
  modelConfig: ModelConfig;
  pluginConfig: TConfig;
  systemPrompt: string | null;
  thinkingEnabled: boolean;
  userId: string;
}

export interface RuntimePluginPrepareContextResult {
  systemPromptSections?: RuntimePluginSystemPromptSection[];
}

export interface RuntimePluginRunSummary {
  error?: string;
  output?: string;
  reachedMaxTurns?: boolean;
  status: "cancelled" | "completed" | "failed";
}

export interface RuntimePluginRunCompleteInput<TConfig = unknown> {
  agent: Agent;
  pluginConfig: TConfig;
  run: RuntimePluginRunSummary;
  sessionId: string;
  userId: string;
}

export interface RuntimePlugin<TConfig = unknown> {
  id: string;
  /**
   * Invoked once when the runtime is bootstrapped. Use this to set up
   * background work such as cron jobs or timers. Called sequentially in
   * resolved plugin order; failures are fatal.
   */
  onInit?: (
    input: RuntimePluginInitInput<TConfig>,
  ) => Promise<void> | void;
  /**
   * Invoked when the runtime is shutting down. Use this to clean up
   * resources created in onInit (clear timers, close connections, etc.).
   */
  onDestroy?: () => Promise<void> | void;
  /**
   * Invoked after a run reaches a terminal outcome. Hooks execute in the
   * resolved plugin order from runtime config, and failures are treated as
   * fatal by the runtime.
   */
  onRunComplete?: (
    input: RuntimePluginRunCompleteInput<TConfig>,
  ) => Promise<void> | void;
  /**
   * Invoked during context assembly in resolved plugin order. Plugins return
   * structured contributions for the runtime to merge; they must not mutate
   * runtime state directly.
   */
  prepareContext?: (
    input: RuntimePluginPrepareContextInput<TConfig>,
  ) => Promise<RuntimePluginPrepareContextResult | void> | RuntimePluginPrepareContextResult | void;
}

export type RuntimePluginConfig = Record<string, unknown>;
export type RuntimePluginRegistry = Record<string, RuntimePlugin>;

export interface ResolvedRuntimePlugin<TConfig = RuntimePluginConfig> {
  config: TConfig;
  plugin: RuntimePlugin<TConfig>;
}

export interface RuntimePluginsConfig {
  configById?: Record<string, RuntimePluginConfig | undefined>;
  enabled: string[];
}

export interface RuntimeConfig {
  plugins?: RuntimePluginsConfig;
}
