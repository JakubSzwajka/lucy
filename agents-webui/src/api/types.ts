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

export interface ModelDef {
  id: string;
  name: string;
  supportsReasoning?: boolean;
  maxContextTokens: number;
}

export interface ModelsResponse {
  models: ModelDef[];
}
