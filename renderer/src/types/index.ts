// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus = "active" | "archived";

export interface Session {
  id: string;
  userId?: string | null;
  rootAgentId?: string | null;
  title: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionCreate {
  title?: string;
}

export interface SessionUpdate {
  title?: string;
  status?: SessionStatus;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface Agent {
  id: string;
  sessionId: string;
  parentId?: string | null;
  sourceCallId?: string | null;
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

export interface AgentCreate {
  sessionId: string;
  parentId?: string;
  sourceCallId?: string;
  name: string;
  task?: string;
  systemPrompt?: string;
  model?: string;
  config?: Record<string, unknown>;
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

// ============================================================================
// ITEM TYPES - Polymorphic conversation entries
// ============================================================================

export type ItemType = "message" | "tool_call" | "tool_result" | "reasoning";
export type MessageRole = "user" | "assistant" | "system";
export type ToolCallStatus = "pending" | "running" | "completed" | "failed";

// Base item fields shared by all types
export interface ItemBase {
  id: string;
  agentId: string;
  sequence: number;
  type: ItemType;
  createdAt: Date;
}

// Message item
export interface MessageItem extends ItemBase {
  type: "message";
  role: MessageRole;
  content: string;
}

// Tool call item
export interface ToolCallItem extends ItemBase {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs?: Record<string, unknown> | null;
  toolStatus: ToolCallStatus;
}

// Tool result item
export interface ToolResultItem extends ItemBase {
  type: "tool_result";
  callId: string;
  toolOutput?: string | null;
  toolError?: string | null;
}

// Reasoning item
export interface ReasoningItem extends ItemBase {
  type: "reasoning";
  reasoningSummary?: string | null;
  reasoningContent: string;
}

// Union type for all items
export type Item = MessageItem | ToolCallItem | ToolResultItem | ReasoningItem;

// For creating items (without id, sequence, createdAt)
export type MessageItemCreate = Omit<MessageItem, "id" | "sequence" | "createdAt">;
export type ToolCallItemCreate = Omit<ToolCallItem, "id" | "sequence" | "createdAt">;
export type ToolResultItemCreate = Omit<ToolResultItem, "id" | "sequence" | "createdAt">;
export type ReasoningItemCreate = Omit<ReasoningItem, "id" | "sequence" | "createdAt">;
export type ItemCreate = MessageItemCreate | ToolCallItemCreate | ToolResultItemCreate | ReasoningItemCreate;

// ============================================================================
// CHAT MESSAGE TYPE (for UI compatibility with useChat)
// ============================================================================

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt?: Date;
  // Activities extracted from items for display
  activities?: AgentActivity[];
}

// Agent Activity Types - for UI display
export type AgentActivityType = "reasoning" | "tool_call" | "tool_result" | "status";

export interface AgentActivityBase {
  id: string;
  type: AgentActivityType;
  timestamp?: Date;
}

export interface ReasoningActivity extends AgentActivityBase {
  type: "reasoning";
  content: string;
  summary?: string;
}

export interface ToolCallActivity extends AgentActivityBase {
  type: "tool_call";
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: ToolCallStatus;
}

export interface ToolResultActivity extends AgentActivityBase {
  type: "tool_result";
  callId: string;
  result?: string;
  error?: string;
}

export interface StatusActivity extends AgentActivityBase {
  type: "status";
  message: string;
  status: "info" | "success" | "warning" | "error";
}

export type AgentActivity = ReasoningActivity | ToolCallActivity | ToolResultActivity | StatusActivity;

// ============================================================================
// SESSION WITH AGENTS (for loading full session data)
// ============================================================================

export interface SessionWithAgents extends Session {
  agents: AgentWithItems[];
}

export interface AgentWithItems extends Agent {
  items: Item[];
  children?: AgentWithItems[];
}

// ============================================================================
// MODEL TYPES
// ============================================================================

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

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface UserSettings {
  id: string;
  defaultModelId: string | null;
  defaultSystemPromptId: string | null;
  enabledModels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsUpdate {
  defaultModelId?: string | null;
  defaultSystemPromptId?: string | null;
  enabledModels?: string[];
}

// ============================================================================
// SYSTEM PROMPT TYPES
// ============================================================================

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemPromptCreate {
  name: string;
  content: string;
}

export interface SystemPromptUpdate {
  name?: string;
  content?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiError {
  error: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
