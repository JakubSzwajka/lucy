// --- Memory Observer Types ---

export interface MemoryObserverConfig {
  modelId: string;       // which model to use for extraction/synthesis LLM calls
  maxFacts?: number;     // max facts in memory.md (default 50)
}

export type ObservationType = "fact" | "preference" | "principle" | "relationship" | "skill";
export type ObservationGate = "allow" | "discard" | "hold";

export interface Observation {
  id: string;
  ts: number;
  agentId: string;
  type: ObservationType;
  content: string;
  confidence: number;
  gate: ObservationGate;
  category: string;
  supersededBy: string | null;
}

/** Tracks last-processed line offset per agent in their items JSONL */
export interface CursorState {
  agents: Record<string, number>;
}

// File path constants (relative to data directory)
export const CURSOR_PATH = "memory/cursor.json";
export const MEMORY_DIR = "memory";
export const MEMORY_MD_PATH = "memory/memory.md";
export const OBSERVATIONS_PATH = "memory/observations.jsonl";
