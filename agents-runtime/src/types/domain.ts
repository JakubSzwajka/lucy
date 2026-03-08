export type AgentStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface Agent {
  id: string;
  agentConfigId: string;
  name: string;
  task?: string | null;
  systemPrompt?: string | null;
  model?: string | null;
  config?: Record<string, unknown> | null;
  status: AgentStatus;
  waitingForCallId?: string | null;
  result?: string | null;
  error?: string | null;
  turnCount: number;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface AgentUpdate {
  status?: AgentStatus;
  waitingForCallId?: string | null;
  result?: string;
  error?: string;
  turnCount?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export type ItemType = "message" | "tool_call" | "tool_result" | "reasoning";
export type MessageRole = "user" | "assistant" | "system";
export type ToolCallStatus = "pending" | "pending_approval" | "running" | "completed" | "failed";

export interface ItemBase {
  id: string;
  agentId: string;
  sequence: number;
  type: ItemType;
  createdAt: Date;
}

export interface MessageItem extends ItemBase {
  type: "message";
  role: MessageRole;
  content: string;
  contentParts?: string | null;
}

export interface ToolCallItem extends ItemBase {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs?: Record<string, unknown> | null;
  toolStatus: ToolCallStatus;
}

export interface ToolResultItem extends ItemBase {
  type: "tool_result";
  callId: string;
  toolOutput?: string | null;
  toolError?: string | null;
}

export interface ReasoningItem extends ItemBase {
  type: "reasoning";
  reasoningSummary?: string | null;
  reasoningContent: string;
}

export type Item = MessageItem | ToolCallItem | ToolResultItem | ReasoningItem;

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  supportsReasoning?: boolean;
  supportsImages?: boolean;
  maxContextTokens: number;
}

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentConfigToolType = "mcp" | "builtin" | "delegate";

export interface AgentConfigTool {
  id: string;
  agentConfigId: string;
  toolType: AgentConfigToolType;
  toolRef: string;
  toolName: string | null;
  toolDescription: string | null;
}

export interface AgentConfig {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPromptId: string | null;
  defaultModelId: string | null;
  maxTurns: number;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfigWithTools extends AgentConfig {
  tools: AgentConfigTool[];
}

export interface IdentityContent {
  values: string[];
  capabilities: string[];
  growthNarrative: string;
  keyRelationships: { name: string; nature: string }[];
}

export interface IdentityDocument {
  id: string;
  userId: string;
  version: number;
  content: IdentityContent;
  isActive: boolean;
  generatedAt: string;
}

export type ModelMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image"; image: URL }>;

export interface ModelMessage {
  role: "user" | "assistant" | "system";
  content: ModelMessageContent;
}
