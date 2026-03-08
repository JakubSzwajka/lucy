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

export interface ResolvedRuntimePlugin<TConfig = RuntimePluginConfig> {
  config: TConfig;
  plugin: RuntimePlugin<TConfig>;
}

export interface CompactionConfig {
  summarizationModel?: string;
  windowSize?: number;
}

export interface RuntimeConfig {
  compaction?: CompactionConfig;
}

// ---------------------------------------------------------------------------
// Gateway plugin types (framework-agnostic)
// ---------------------------------------------------------------------------

export interface GatewayPluginInitInput<
  TConfig = unknown,
  TApp = unknown,
  TRuntime = unknown,
> {
  app: TApp;
  pluginConfig: TConfig;
  runtime: TRuntime;
}

export interface GatewayPlugin<TConfig = unknown> {
  id: string;
  /**
   * Invoked once when the gateway is bootstrapped. Use this to register
   * routes on the app instance and capture the runtime reference. Called
   * sequentially in resolved plugin order; failures are fatal.
   */
  onInit?: (
    input: GatewayPluginInitInput<TConfig>,
  ) => Promise<void> | void;
  /**
   * Invoked when the gateway is shutting down. Use this to clean up
   * resources created in onInit (clear timers, close connections, etc.).
   */
  onDestroy?: () => Promise<void> | void;
}

export type GatewayPluginConfig = Record<string, unknown>;

export interface ResolvedGatewayPlugin<TConfig = GatewayPluginConfig> {
  config: TConfig;
  plugin: GatewayPlugin<TConfig>;
}

// ---------------------------------------------------------------------------
// Plugin manifest types (package-level declarations)
// ---------------------------------------------------------------------------

export type PluginType = "runtime" | "gateway" | "both";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- manifest return types are type-erased; the loader doesn't know the plugin's internal config type
export interface RuntimePluginManifest<TConfig = unknown> {
  id: string;
  type: "runtime";
  create: (config: TConfig) => RuntimePlugin<any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GatewayPluginManifest<TConfig = unknown> {
  id: string;
  type: "gateway";
  create: (config: TConfig) => GatewayPlugin<any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DualPluginManifest<TConfig = unknown> {
  id: string;
  type: "both";
  create: (config: TConfig) => {
    runtime: RuntimePlugin<any>;
    gateway: GatewayPlugin<any>;
  };
}

export type PluginManifest<TConfig = unknown> =
  | RuntimePluginManifest<TConfig>
  | GatewayPluginManifest<TConfig>
  | DualPluginManifest<TConfig>;
