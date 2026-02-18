export const memoryTypes = ["fact", "preference", "relationship", "principle", "commitment", "moment", "skill"] as const;
export type MemoryType = (typeof memoryTypes)[number];

export const confidenceLevels = ["explicit", "implied", "inferred", "speculative"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const memoryStatuses = ["active", "archived", "pending_review"] as const;
export type MemoryStatus = (typeof memoryStatuses)[number];

export const relationshipTypes = ["relates_to", "contradicts", "refines", "supports", "context_for"] as const;
export type RelationshipType = (typeof relationshipTypes)[number];

export const curiosityTypes = ["gap", "implication", "clarification", "exploration", "connection"] as const;
export type CuriosityType = (typeof curiosityTypes)[number];

export const questionTimings = ["next_session", "when_relevant", "low_priority"] as const;
export type QuestionTiming = (typeof questionTimings)[number];

export const questionStatuses = ["pending", "resolved"] as const;
export type QuestionStatus = (typeof questionStatuses)[number];

export interface Memory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  tags: string[];
  scope: string | null;
  status: MemoryStatus;
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export interface MemoryEvidence {
  id: string;
  memoryId: string;
  sourceType: string;
  sourceId: string | null;
  excerpt: string;
  createdAt: string;
}

export interface MemoryWithEvidence extends Memory {
  evidence?: MemoryEvidence[];
}

export interface Question {
  id: string;
  userId: string;
  content: string;
  context: string;
  curiosityType: CuriosityType;
  curiosityScore: number;
  timing: QuestionTiming;
  scope: string | null;
  status: QuestionStatus;
  answer: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface IdentityContent {
  values: string[];
  capabilities: string[];
  growthNarrative: string;
  keyRelationships: { name: string; nature: string }[];
}

export interface IdentityDocument {
  id: string;
  userId: string;
  version: number;
  content: IdentityContent;
  isActive: boolean;
  generatedAt: string;
}

export interface MemoryFilters {
  type?: MemoryType;
  status?: MemoryStatus;
  minConfidence?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  tags?: string[];
  scope?: string;
}

export type UpdateMemoryInput = Partial<CreateMemoryInput> & { status?: MemoryStatus };

export interface MemorySettingsData {
  autoExtract: boolean;
  defaultScope: string;
  maxContextMemories: number;
  questionsPerSession: number;
  reflectionTokenThreshold: number;
  reflectionAgentConfigId: string | null;
}
