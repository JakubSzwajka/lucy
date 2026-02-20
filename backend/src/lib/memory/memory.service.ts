import { eq, and, sql } from "drizzle-orm";
import { getMemoryStore } from "./storage";
import type { MemoryStore } from "./storage/memory-store.interface";
import type {
  Memory,
  MemoryEvidence,
  MemoryStats,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryFilters,
  SearchOptions,
  CreateEvidenceInput,
} from "./types";
import { memoryTypes } from "./types";
import { db } from "../db";
import { memories as memoriesTable } from "../db/schema";

export class MemoryService {
  private static instance: MemoryService | null = null;
  private store: MemoryStore;

  private constructor() {
    this.store = getMemoryStore();
  }

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  async create(
    userId: string,
    input: CreateMemoryInput,
    evidence?: CreateEvidenceInput
  ): Promise<{ memory: Memory; duplicateWarning?: string }> {
    // Validate
    if (input.confidenceScore < 0 || input.confidenceScore > 1) {
      throw new Error("confidenceScore must be between 0 and 1");
    }
    if (!memoryTypes.includes(input.type)) {
      throw new Error(`Invalid memory type: ${input.type}`);
    }

    // Dedup check
    let duplicateWarning: string | undefined;
    const similar = await this.store.searchMemories(userId, input.content, { limit: 3 });
    for (const existing of similar) {
      if (this.calculateSimilarity(input.content, existing.content) > 0.8) {
        duplicateWarning = `Similar memory exists: ${existing.id} - ${existing.content.slice(0, 80)}`;
        break;
      }
    }

    const [memory] = await this.store.addMemories(userId, [input]);

    if (evidence) {
      await this.store.addEvidence(userId, memory.id, evidence);
    }

    return { memory, duplicateWarning };
  }

  async getById(
    userId: string,
    id: string
  ): Promise<{ memory: Memory; evidence: MemoryEvidence[] } | null> {
    const [row] = await db
      .select()
      .from(memoriesTable)
      .where(and(eq(memoriesTable.id, id), eq(memoriesTable.userId, userId)));

    if (!row) return null;

    const memory: Memory = {
      id: row.id,
      userId: row.userId,
      type: row.type,
      content: row.content,
      confidenceScore: row.confidenceScore,
      confidenceLevel: row.confidenceLevel,
      tags: row.tags ?? [],
      scope: row.scope,
      status: row.status,
      supersededBy: row.supersededBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastAccessedAt: row.lastAccessedAt,
    };

    await this.store.touchMemory(userId, id);
    const evidence = await this.store.getEvidence(userId, id);

    return { memory, evidence };
  }

  async list(userId: string, filters?: MemoryFilters): Promise<Memory[]> {
    return this.store.loadMemories(userId, filters);
  }

  async search(userId: string, query: string, opts?: SearchOptions): Promise<Memory[]> {
    return this.store.searchMemories(userId, query, opts);
  }

  async update(userId: string, id: string, data: UpdateMemoryInput): Promise<Memory> {
    return this.store.updateMemory(userId, id, data);
  }

  async supersede(userId: string, oldId: string, newInput: CreateMemoryInput): Promise<Memory> {
    return this.store.supersedeMemory(userId, oldId, newInput);
  }

  async delete(userId: string, id: string): Promise<void> {
    return this.store.deleteMemory(userId, id);
  }

  async getStats(userId: string): Promise<MemoryStats> {
    return this.store.getStats(userId);
  }

  async addEvidence(
    userId: string,
    memoryId: string,
    evidence: CreateEvidenceInput
  ): Promise<MemoryEvidence> {
    return this.store.addEvidence(userId, memoryId, evidence);
  }

  async getDistinctTags(userId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ tag: sql<string>`jsonb_array_elements_text(${memoriesTable.tags})` })
      .from(memoriesTable)
      .where(and(eq(memoriesTable.userId, userId), eq(memoriesTable.status, "active")));

    return rows.map((r) => r.tag).sort();
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    return intersection.length / Math.max(wordsA.size, wordsB.size);
  }
}

export function getMemoryService(): MemoryService {
  return MemoryService.getInstance();
}
