export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  createdAt?: Date;
  activities?: AgentActivity[];
}

// Agent Activity Types - extensible for future use
export type AgentActivityType = "reasoning" | "tool_call" | "tool_result" | "status";

export interface AgentActivityBase {
  id: string;
  type: AgentActivityType;
  timestamp?: Date;
}

export interface ReasoningActivity extends AgentActivityBase {
  type: "reasoning";
  content: string;
}

export interface ToolCallActivity extends AgentActivityBase {
  type: "tool_call";
  toolName: string;
  args?: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
}

export interface ToolResultActivity extends AgentActivityBase {
  type: "tool_result";
  toolCallId: string;
  result?: unknown;
  error?: string;
}

export interface StatusActivity extends AgentActivityBase {
  type: "status";
  message: string;
  status: "info" | "success" | "warning" | "error";
}

export type AgentActivity = ReasoningActivity | ToolCallActivity | ToolResultActivity | StatusActivity;

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  modelId: string;
  supportsReasoning?: boolean;
}

export interface AvailableProviders {
  openai: boolean;
  anthropic: boolean;
  google: boolean;
}
