export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  supportsReasoning?: boolean;
  supportsImages?: boolean;
  maxContextTokens: number;
}

export interface IdentityContent {
  values: string[];
  capabilities: string[];
  growthNarrative: string;
  keyRelationships: { name: string; nature: string }[];
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
