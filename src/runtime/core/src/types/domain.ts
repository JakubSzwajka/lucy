export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  supportsReasoning?: boolean;
  supportsImages?: boolean;
  maxContextTokens: number;
}

// ---------------------------------------------------------------------------
// History entries (discriminated union)
// ---------------------------------------------------------------------------

interface EntryBase {
  id: string;
  sequence: number;
  agentId: string;
  createdAt: Date;
}

export interface MessageEntry extends EntryBase {
  type: "message";
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallEntry extends EntryBase {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
  toolStatus: "completed" | "failed" | "running";
}

export interface ToolResultEntry extends EntryBase {
  type: "tool_result";
  callId: string;
  toolOutput?: string;
  toolError?: string;
}

export interface ReasoningEntry extends EntryBase {
  type: "reasoning";
  reasoningContent: string;
  reasoningSummary?: string;
}

export type HistoryEntry = MessageEntry | ToolCallEntry | ToolResultEntry | ReasoningEntry;

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
