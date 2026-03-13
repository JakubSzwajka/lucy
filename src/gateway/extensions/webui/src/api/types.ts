// ---------------------------------------------------------------------------
// Items (discriminated union)
// ---------------------------------------------------------------------------

interface ItemBase {
  id: string;
  agentId: string;
  sequence: number;
  createdAt: string;
}

export interface MessageItem extends ItemBase {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCallItem extends ItemBase {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
  toolStatus: string;
  createdAt: string;
}

export interface ToolResultItem extends ItemBase {
  type: "tool_result";
  callId: string;
  toolOutput?: string;
  toolError?: string;
}

export interface ReasoningItem extends ItemBase {
  type: "reasoning";
  reasoningContent: string;
  reasoningSummary?: string;
}

export type Item = MessageItem | ReasoningItem | ToolCallItem | ToolResultItem;

// ---------------------------------------------------------------------------
// Stream events (from SSE)
// ---------------------------------------------------------------------------

export interface AgentStartStreamEvent {
  type: "agent_start";
}

export interface AgentEndStreamEvent {
  type: "agent_end";
}

export interface TextDeltaStreamEvent {
  type: "text_delta";
  delta: string;
}

export interface ThinkingDeltaStreamEvent {
  type: "thinking_delta";
  delta: string;
}

export interface ToolStartStreamEvent {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolEndStreamEvent {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  output: string;
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
}

export type StreamEvent =
  | AgentStartStreamEvent
  | AgentEndStreamEvent
  | TextDeltaStreamEvent
  | ThinkingDeltaStreamEvent
  | ToolStartStreamEvent
  | ToolEndStreamEvent
  | StreamErrorEvent;

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

export interface HistoryResponse {
  items: Item[];
  compactionSummary: string | null;
}

export interface ChatResponse {
  response: string;
  agentId: string;
  reachedMaxTurns: boolean;
}

export interface SessionInfo {
  sessionId: string;
  sessionName?: string;
  model: {
    id: string;
    provider: string;
    contextWindow: number;
  };
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  messages: {
    user: number;
    assistant: number;
    toolCalls: number;
    total: number;
  };
  compaction: {
    enabled: boolean;
    isCompacting: boolean;
    threshold: number;
    usage: number;
  };
}

