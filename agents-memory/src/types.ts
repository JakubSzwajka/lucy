import type {
  RuntimePlugin,
  RuntimePluginPrepareContextInput,
  RuntimePluginPrepareContextResult,
  RuntimePluginRunCompleteInput,
  RuntimePluginSystemPromptSection,
} from "agents-runtime";

export interface MemoryContextRecord {
  content: string;
  title?: string;
}

export interface MemoryPluginContext {
  latestRun?: MemoryPluginObservedRun;
  memory?: MemoryContextRecord | null;
}

export interface MemoryPluginObservedRun {
  agentId: string;
  output?: string;
  status: "cancelled" | "completed" | "failed";
  userId: string;
}

export interface MemoryPluginConfig {
  getContext?: (
    input: MemoryPluginPrepareContextInput,
  ) => MemoryContextRecord | null | undefined | Promise<MemoryContextRecord | null | undefined>;
  initialMemory?: MemoryContextRecord | null;
  onRunObserved?: (
    input: MemoryPluginRunCompleteInput,
    context: MemoryPluginContext,
  ) => void | Promise<void>;
}

export interface MemoryPluginOptions {
  dataDir?: string;
  id?: string;
  observer?: {
    modelId: string;
    maxFacts?: number;
  };
}

export type MemoryPlugin = RuntimePlugin<MemoryPluginConfig>;

export type MemoryPluginPrepareContextInput = RuntimePluginPrepareContextInput<MemoryPluginConfig>;
export type MemoryPluginPrepareContextResult = RuntimePluginPrepareContextResult;
export type MemoryPluginRunCompleteInput = RuntimePluginRunCompleteInput<MemoryPluginConfig>;
export type MemoryPluginSystemPromptSectionShape = RuntimePluginSystemPromptSection;

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
