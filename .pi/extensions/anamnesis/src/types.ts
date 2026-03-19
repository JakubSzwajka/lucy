// ---------------------------------------------------------------------------
// Anamnesis — Type definitions, constants, and helpers
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const MEMORY_TYPES = [
  "fact",
  "preference",
  "relationship",
  "principle",
  "commitment",
  "moment",
  "skill",
] as const;

export const CURIOSITY_TYPES = [
  "gap",
  "implication",
  "clarification",
  "exploration",
  "connection",
  "wonder",
] as const;

export const CONFIDENCE_RANGES = {
  explicit: [0.95, 1.0],
  implied: [0.7, 0.94],
  inferred: [0.4, 0.69],
  speculative: [0.0, 0.39],
} as const;

export const DEFAULT_DECAY_RATES: Record<string, number> = {
  fact: 0.0,
  preference: 0.1,
  relationship: 0.05,
  principle: 0.0,
  commitment: 0.2,
  moment: 0.0,
  skill: 0.0,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type ConfidenceLevel = "explicit" | "implied" | "inferred" | "speculative";
export type SourceType =
  | "user_stated"
  | "user_confirmed"
  | "context_implied"
  | "pattern_inferred"
  | "behavioral_signal"
  | "hypothesis";
export type CuriosityType = (typeof CURIOSITY_TYPES)[number];
export type QuestionTiming = "next_session" | "when_relevant" | "low_priority";
export type Sensitivity = "low" | "medium" | "high";
export type QuestionStatus = "pending" | "asked" | "answered" | "skipped" | "expired";

export interface Confidence {
  score: number;
  level?: ConfidenceLevel;
  source?: SourceType;
  evidence?: string[];
  decay_rate?: number;
}

export interface Salience {
  importance?: number;
  novelty?: number;
  affect_heuristic?: { valence: number; arousal: number };
}

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source_quote?: string;
  source_turn?: string;
  tags?: string[];
  context?: string;
  uncertain?: boolean;
  created_at?: string;
  session_id?: string;
  confidence?: Confidence;
  salience?: Salience;
  valid_from?: string;
  valid_until?: string;
  still_valid?: boolean;
  supersedes?: string;
  last_accessed?: string;
  confabulation_risk?: boolean;
  confabulation_reason?: string;
}

export interface CuriosityQuestion {
  id: string;
  question: string;
  context?: string;
  source_memory_ids?: string[];
  curiosity_type?: CuriosityType;
  curiosity_score?: number;
  timing?: QuestionTiming;
  sensitivity?: Sensitivity;
  status: QuestionStatus;
  created_at?: string;
  answered_at?: string;
  answer_summary?: string;
  skip_reason?: string;
}

export interface Prediction {
  id: string;
  content: string;
  planted: string;
  status: "pending" | "confirmed" | "violated" | "resolved";
  confidence?: number;
  source_memory_ids?: string[];
  resolved_at?: string;
}

export interface ReflectionJob {
  job_id: string;
  status: string;
  session_id: string;
  created_at: string;
  completed_at?: string;
  phases: Record<string, { started_at: string; completed_at?: string; items_processed?: number }>;
  output: Record<string, unknown>;
  error?: { phase: string; message: string; stack?: string };
}

export interface EvolutionResult {
  added: Memory[];
  superseded: Array<{ old_id: string; new_id: string }>;
  reinforced: Array<{ existing_id: string; new_content: string }>;
}

export interface ReflectionResult {
  job: ReflectionJob;
  memories: Memory[];
  questions: CuriosityQuestion[];
  predictions?: Prediction[];
  metadata: {
    extraction: Record<string, unknown>;
    scoring: Record<string, unknown>;
    generation: Record<string, unknown>;
    total_time_ms: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.95) return "explicit";
  if (score >= 0.7) return "implied";
  if (score >= 0.4) return "inferred";
  return "speculative";
}

export function validateMemory(memory: Partial<Memory>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!memory.id?.startsWith("mem_")) errors.push("Invalid memory ID format");
  if (!memory.type || !MEMORY_TYPES.includes(memory.type)) errors.push(`Invalid memory type: ${memory.type}`);
  if (!memory.content?.length) errors.push("Memory content is required");
  return { valid: errors.length === 0, errors };
}
