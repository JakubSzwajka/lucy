import type {
  LanguageModel,
  StreamTextResult,
  ToolSet,
} from "ai";
import type {
  ConfigStore,
  IdentityProvider,
  ItemStore,
  ModelProvider,
  SessionStore,
  AgentStore,
} from "../ports.js";
import type {
  Agent,
  ModelConfig,
} from "./domain.js";
import type {
  RuntimeConfig,
} from "./plugins.js";

export interface AgentRuntimeOptions {
  config?: RuntimeConfig;
  deps?: Partial<RuntimeDeps>;
}

export interface BootstrapAgentRuntimeOptions {
  config?: RuntimeConfig;
  deps?: Partial<RuntimeDeps>;
  pluginRegistry?: import("./plugins.js").RuntimePluginRegistry;
}

export interface ChatContext {
  agent: Agent;
  languageModel: LanguageModel;
  modelConfig: ModelConfig;
  tools: Record<string, unknown>;
  providerOptions?: unknown;
  maxOutputTokens?: number;
  systemPrompt: string | null;
  isThinkingActive: boolean;
}

export type RunOptions = {
  sessionId: string;
  modelId?: string;
  thinkingEnabled?: boolean;
  onFinish?: () => Promise<void>;
} & (
  | { streaming: true }
  | { streaming: false; maxTurns?: number }
);

export type RunResult =
  | { streaming: true; stream: StreamTextResult<ToolSet, unknown> }
  | { streaming: false; result: string; reachedMaxTurns: boolean };

export interface RuntimeDeps {
  agents: AgentStore;
  items: ItemStore;
  config: ConfigStore;
  models: ModelProvider;
  identity: IdentityProvider;
  sessions: SessionStore;
}
