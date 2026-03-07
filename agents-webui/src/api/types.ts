// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  agentConfigId?: string;
  modelId?: string;
  systemPrompt?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
  modelId?: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface HealthResponse {
  ok: true;
}

export interface CreateSessionResponse {
  sessionId: string;
  agentId: string;
}

export interface SessionSummary {
  id: string;
  agentId: string;
  updatedAt: string;
  agent: {
    status: string;
    turnCount: number;
  };
}

export interface SessionListResponse {
  sessions: SessionSummary[];
}

export interface SessionDetailResponse {
  session: {
    id: string;
    updatedAt: string;
  };
  agent: {
    id: string;
    status: string;
    turnCount: number;
    result?: string;
  };
}

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

export interface ItemsResponse {
  items: Item[];
}

export interface ChatResponse {
  response: string;
  agentId: string;
  reachedMaxTurns: boolean;
}
