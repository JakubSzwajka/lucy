import type {
  Memory,
  MemoryEvidence,
  MemoryConnection,
  Question,
  IdentityDocument,
  Reflection,
  MemoryStats,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryFilters,
  SearchOptions,
  CreateEvidenceInput,
  CreateConnectionInput,
  GraphResult,
  CreateQuestionInput,
  QuestionFilters,
  QuestionResolution,
  CreateReflectionInput,
  IdentityContent,
} from '../types';

export interface MemoryStore {
  // Initialization
  init(): Promise<void>;

  // Memory CRUD
  loadMemories(userId: string, filters?: MemoryFilters): Promise<Memory[]>;
  addMemories(userId: string, memories: CreateMemoryInput[]): Promise<Memory[]>;
  updateMemory(userId: string, id: string, data: UpdateMemoryInput): Promise<Memory>;
  deleteMemory(userId: string, id: string): Promise<void>;
  searchMemories(userId: string, query: string, opts?: SearchOptions): Promise<Memory[]>;
  touchMemory(userId: string, id: string): Promise<void>;
  supersedeMemory(userId: string, oldId: string, newMemory: CreateMemoryInput): Promise<Memory>;

  // Evidence
  addEvidence(userId: string, memoryId: string, evidence: CreateEvidenceInput): Promise<MemoryEvidence>;
  getEvidence(userId: string, memoryId: string): Promise<MemoryEvidence[]>;

  // Connections (Phase 6)
  addConnections(userId: string, connections: CreateConnectionInput[]): Promise<MemoryConnection[]>;
  getConnections(userId: string, memoryId: string): Promise<MemoryConnection[]>;
  getGraph(userId: string, memoryId: string, depth: number): Promise<GraphResult>;
  deleteConnection(userId: string, connectionId: string): Promise<void>;

  // Questions (Phase 7)
  loadQuestions(userId: string, filters?: QuestionFilters): Promise<Question[]>;
  addQuestion(userId: string, question: CreateQuestionInput, sourceMemoryIds: string[]): Promise<Question>;
  resolveQuestion(userId: string, id: string, resolution: QuestionResolution): Promise<Question>;
  getQuestionsToSurface(userId: string, limit: number): Promise<Question[]>;
  deleteQuestion(userId: string, id: string): Promise<void>;

  // Identity (Phase 8)
  loadIdentity(userId: string): Promise<IdentityDocument | null>;
  updateIdentity(userId: string, content: IdentityContent): Promise<IdentityDocument>;
  listIdentityVersions(userId: string): Promise<IdentityDocument[]>;

  // Reflections (Phase 4)
  saveReflection(userId: string, reflection: CreateReflectionInput): Promise<Reflection>;
  loadReflections(userId: string, limit?: number): Promise<Reflection[]>;

  // Stats
  getStats(userId: string): Promise<MemoryStats>;
}
