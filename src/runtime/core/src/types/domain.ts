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
