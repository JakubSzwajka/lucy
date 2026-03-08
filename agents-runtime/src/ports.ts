import type { LanguageModel } from "ai";
import type {
  Agent,
  AgentUpdate,
  Item,
  MessageItem,
  ToolCallItem,
  ToolResultItem,
  ToolCallStatus,
  ModelConfig,
  AgentConfigWithTools,
  SystemPrompt,
  IdentityDocument,
} from "./types.js";

/** Reads and updates agent state */
export interface AgentStore {
  create(agent: Agent): Promise<Agent>;
  getById(agentId: string): Promise<Agent | null>;
  update(agentId: string, update: AgentUpdate): Promise<void>;
}

/** Reads and appends conversation items */
export interface ItemStore {
  getByAgentId(agentId: string): Promise<Item[]>;
  create(item: Item): Promise<Item>;
  createMessage(
    agentId: string,
    data: Omit<MessageItem, "id" | "agentId" | "sequence" | "createdAt" | "type">,
  ): Promise<MessageItem>;
  createToolCall(
    agentId: string,
    data: Omit<ToolCallItem, "id" | "agentId" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolCallItem>;
  createToolResult(
    agentId: string,
    data: Omit<ToolResultItem, "id" | "agentId" | "sequence" | "createdAt" | "type">,
  ): Promise<ToolResultItem>;
  updateToolCallStatus(itemId: string, status: ToolCallStatus): Promise<void>;
}

/** Reads agent configs and system prompts */
export interface ConfigStore {
  getAgentConfig(configId: string): Promise<AgentConfigWithTools | null>;
  getSystemPrompt(promptId: string): Promise<SystemPrompt | null>;
  createAgentConfig(config: AgentConfigWithTools): Promise<AgentConfigWithTools>;
  createSystemPrompt(prompt: SystemPrompt): Promise<SystemPrompt>;
}

/** Resolves models to AI SDK instances */
export interface ModelProvider {
  getModelConfig(modelId: string): Promise<ModelConfig | undefined>;
  getLanguageModel(config: ModelConfig): LanguageModel;
  buildProviderOptions(
    config: ModelConfig,
    thinkingEnabled: boolean,
  ): unknown;
}

/** Provides identity documents for context enrichment */
export interface IdentityProvider {
  getActive(userId: string): Promise<IdentityDocument | null>;
}
