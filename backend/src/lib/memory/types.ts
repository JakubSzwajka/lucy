// Memory types
export const memoryTypes = ["fact", "preference", "relationship", "principle", "commitment", "moment", "skill"] as const;
export type MemoryType = (typeof memoryTypes)[number];

// Confidence levels
export const confidenceLevels = ["explicit", "implied", "inferred", "speculative"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

// Memory statuses
export const memoryStatuses = ["active", "archived", "pending_review"] as const;
export type MemoryStatus = (typeof memoryStatuses)[number];

// Relationship types
export const relationshipTypes = ["relates_to", "contradicts", "refines", "supports", "context_for"] as const;
export type RelationshipType = (typeof relationshipTypes)[number];

// Curiosity types
export const curiosityTypes = ["gap", "implication", "clarification", "exploration", "connection"] as const;
export type CuriosityType = (typeof curiosityTypes)[number];

// Question timings
export const questionTimings = ["next_session", "when_relevant", "low_priority"] as const;
export type QuestionTiming = (typeof questionTimings)[number];

// Question statuses
export const questionStatuses = ["pending", "resolved"] as const;
export type QuestionStatus = (typeof questionStatuses)[number];

// Evidence source types
export const evidenceSourceTypes = ["session", "item", "manual"] as const;
export type EvidenceSourceType = (typeof evidenceSourceTypes)[number];

// --- Domain interfaces ---

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
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

export interface MemoryEvidence {
  id: string;
  memoryId: string;
  sourceType: EvidenceSourceType;
  sourceId: string | null;
  excerpt: string;
  createdAt: Date;
}

export interface MemoryConnection {
  id: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationshipType: RelationshipType;
  strength: number;
  createdAt: Date;
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
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface QuestionMemoryLink {
  id: string;
  questionId: string;
  memoryId: string;
  linkType: "triggered_by" | "answered_by";
  createdAt: Date;
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
  generatedAt: Date;
}

export interface Reflection {
  id: string;
  userId: string;
  sessionId: string;
  memoriesExtracted: number;
  questionsGenerated: number;
  modelUsed: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  byStatus: Record<MemoryStatus, number>;
  byConfidenceLevel: Record<ConfidenceLevel, number>;
}

// --- Input types ---

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  tags?: string[];
  scope?: string;
  status?: MemoryStatus;
}

export type UpdateMemoryInput = Partial<CreateMemoryInput>;

export interface MemoryFilters {
  type?: MemoryType | MemoryType[];
  scope?: string;
  status?: MemoryStatus;
  minConfidence?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchOptions {
  limit?: number;
  minConfidence?: number;
  types?: MemoryType[];
}

export interface CreateEvidenceInput {
  sourceType: EvidenceSourceType;
  sourceId?: string;
  excerpt: string;
}

export interface CreateConnectionInput {
  fromMemoryId: string;
  toMemoryId: string;
  relationshipType: RelationshipType;
  strength: number;
}

export interface CreateQuestionInput {
  content: string;
  context: string;
  curiosityType: CuriosityType;
  curiosityScore: number;
  timing: QuestionTiming;
  scope?: string;
}

export interface QuestionFilters {
  status?: QuestionStatus;
  scope?: string;
  timing?: QuestionTiming;
  limit?: number;
  offset?: number;
}

export interface QuestionResolution {
  answer: string;
  answeringMemoryId?: string;
}

export interface CreateReflectionInput {
  sessionId: string;
  memoriesExtracted: number;
  questionsGenerated: number;
  modelUsed: string;
  metadata?: Record<string, unknown>;
}

export interface GraphResult {
  nodes: Memory[];
  edges: MemoryConnection[];
}

// --- Memory Settings ---

export interface MemorySettings {
  id: string;
  userId: string;
  autoExtract: boolean;
  defaultScope: string;
  maxContextMemories: number;
  questionsPerSession: number;
  reflectionAgentConfigId: string | null;
  reflectionTokenThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateMemorySettingsInput {
  autoExtract?: boolean;
  defaultScope?: string;
  maxContextMemories?: number;
  questionsPerSession?: number;
  reflectionAgentConfigId?: string | null;
  reflectionTokenThreshold?: number;
}

export const MEMORY_SETTINGS_DEFAULTS: Required<UpdateMemorySettingsInput> = {
  autoExtract: false,
  defaultScope: "global",
  maxContextMemories: 20,
  questionsPerSession: 3,
  reflectionAgentConfigId: null,
  reflectionTokenThreshold: 5000,
};
