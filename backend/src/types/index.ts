// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus = "active" | "archived";

export interface Session {
  id: string;
  userId: string;
  rootAgentId?: string | null;
  agentConfigId?: string | null;
  parentSessionId?: string | null;
  sourceCallId?: string | null;
  title: string;
  status: SessionStatus;
  reflectionTokenCount: number;
  lastReflectionItemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionCreate {
  title?: string;
  agentConfigId?: string;
  parentSessionId?: string;
  sourceCallId?: string;
}

export interface SessionUpdate {
  title?: string;
  status?: SessionStatus;
  reflectionTokenCount?: number;
  lastReflectionItemCount?: number;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentStatus = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface Agent {
  id: string;
  sessionId: string;
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

export interface AgentCreate {
  sessionId: string;
  agentConfigId: string;
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
export type ToolCallStatus = "pending" | "pending_approval" | "running" | "completed" | "failed";

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
  contentParts?: string | null; // JSON string of multimodal parts, null for text-only
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

// Content part types for interleaved display
export interface TextContentPart {
  type: "text";
  id: string;
  text: string;
}

export interface ReasoningContentPart {
  type: "reasoning";
  id: string;
  content: string;
  summary?: string;
}

export interface ToolCallContentPart {
  type: "tool_call";
  id: string;
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: ToolCallStatus;
  result?: string;
  error?: string;
}

export type ContentPart = TextContentPart | ReasoningContentPart | ToolCallContentPart;

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt?: Date;
  // Interleaved content parts for display (reasoning, text, tool_call in order)
  parts?: ContentPart[];
}

// ============================================================================
// SESSION WITH AGENTS (for loading full session data)
// ============================================================================

export interface ChildSessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  sourceCallId: string | null;
  createdAt: Date;
}

export interface SessionWithAgents extends Session {
  agents: AgentWithItems[];
  childSessions?: ChildSessionSummary[];
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
  maxContextTokens: number;
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
// QUICK ACTION TYPES
// ============================================================================

export interface QuickAction {
  id: string;
  name: string;
  content: string;
  icon: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickActionCreate {
  name: string;
  content: string;
  icon?: string;
  sortOrder?: number;
  enabled?: boolean;
}

export interface QuickActionUpdate {
  name?: string;
  content?: string;
  icon?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}

// ============================================================================
// AGENT CONFIG TYPES
// ============================================================================

export type AgentConfigToolType = "mcp" | "builtin" | "delegate";

export interface AgentConfig {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPromptId: string | null;
  systemPromptOverride: string | null;
  defaultModelId: string | null;
  maxTurns: number;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfigTool {
  id: string;
  agentConfigId: string;
  toolType: AgentConfigToolType;
  toolRef: string;
  toolName: string | null;
  toolDescription: string | null;
}

export interface AgentConfigWithTools extends AgentConfig {
  tools: AgentConfigTool[];
}

export interface AgentConfigCreate {
  name: string;
  description?: string;
  systemPromptId?: string;
  systemPromptOverride?: string;
  defaultModelId?: string;
  maxTurns?: number;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  tools?: {
    type: AgentConfigToolType;
    ref: string;
    toolName?: string;
    toolDescription?: string;
  }[];
}

export interface AgentConfigUpdate {
  name?: string;
  description?: string | null;
  systemPromptId?: string | null;
  systemPromptOverride?: string | null;
  defaultModelId?: string | null;
  maxTurns?: number;
  icon?: string | null;
  color?: string | null;
  isDefault?: boolean;
  tools?: {
    type: AgentConfigToolType;
    ref: string;
    toolName?: string;
    toolDescription?: string;
  }[];
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

// ============================================================================
// MCP (Model Context Protocol) TYPES
// ============================================================================

export type McpTransportType = "stdio" | "sse" | "http";

export interface McpServer {
  id: string;
  name: string;
  description?: string | null;
  transportType: McpTransportType;
  // Stdio transport
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  // HTTP/SSE transport
  url?: string | null;
  headers?: Record<string, string> | null;
  // Settings
  requireApproval: boolean;
  enabled: boolean;
  iconUrl?: string | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface McpServerCreate {
  name: string;
  description?: string;
  transportType: McpTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  requireApproval?: boolean;
  enabled?: boolean;
  iconUrl?: string;
}

export interface McpServerUpdate {
  name?: string;
  description?: string | null;
  transportType?: McpTransportType;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  url?: string | null;
  headers?: Record<string, string> | null;
  requireApproval?: boolean;
  enabled?: boolean;
  iconUrl?: string | null;
}

// Tool discovered from an MCP server
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
  serverName: string;
}

// Connection status for an MCP server
export interface McpServerStatus {
  serverId: string;
  serverName: string;
  connected: boolean;
  tools: McpTool[];
  error?: string;
  requireApproval: boolean;
}

// Session MCP configuration response
export interface SessionMcpConfig {
  enabledServers: McpServerStatus[];
}
