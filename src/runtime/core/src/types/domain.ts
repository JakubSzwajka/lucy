export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  supportsReasoning?: boolean;
  supportsImages?: boolean;
  maxContextTokens: number;
}

export interface HistoryEntry {
  id: string;
  type: "message";
  role: "user" | "assistant";
  content: string;
  sequence: number;
  agentId: string;
  createdAt: Date;
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
