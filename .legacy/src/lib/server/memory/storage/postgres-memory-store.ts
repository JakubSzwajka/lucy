import { eq, and, or, ilike, gte, inArray, sql, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../db";
import { memories, memoryEvidence, memoryConnections, reflections, questions, questionMemoryLinks, identityDocuments } from "../../db/schema";
import type { MemoryRecord, MemoryEvidenceRecord, MemoryConnectionRecord, ReflectionRecord, QuestionRecord, IdentityDocumentRecord } from "../../db/schema";
import type { MemoryStore } from "./memory-store.interface";
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
} from "../types";

export class PostgresMemoryStore implements MemoryStore {
  async init(): Promise<void> {
    return Promise.resolve();
  }

  async loadMemories(userId: string, filters?: MemoryFilters): Promise<Memory[]> {
    const conditions = [eq(memories.userId, userId)];

    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        conditions.push(inArray(memories.type, filters.type));
      } else {
        conditions.push(eq(memories.type, filters.type));
      }
    }
    if (filters?.scope) {
      conditions.push(eq(memories.scope, filters.scope));
    }
    if (filters?.status) {
      conditions.push(eq(memories.status, filters.status));
    }
    if (filters?.minConfidence !== undefined) {
      conditions.push(gte(memories.confidenceScore, filters.minConfidence));
    }
    if (filters?.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        conditions.push(sql`${memories.tags} @> ${JSON.stringify([tag])}::jsonb`);
      }
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const rows = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(limit)
      .offset(offset);

    return rows.map(this.mapToMemory);
  }

  async addMemories(userId: string, inputs: CreateMemoryInput[]): Promise<Memory[]> {
    if (inputs.length === 0) return [];

    const now = new Date();
    const values = inputs.map((input) => ({
      id: `mem_${nanoid()}`,
      userId,
      type: input.type,
      content: input.content,
      confidenceScore: input.confidenceScore,
      confidenceLevel: input.confidenceLevel,
      tags: input.tags ?? [],
      scope: input.scope ?? null,
      status: input.status ?? ("active" as const),
      supersededBy: null,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    }));

    const rows = await db.insert(memories).values(values).returning();
    return rows.map(this.mapToMemory);
  }

  async updateMemory(userId: string, id: string, data: UpdateMemoryInput): Promise<Memory> {
    const rows = await db
      .update(memories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(memories.id, id), eq(memories.userId, userId)))
      .returning();

    if (rows.length === 0) {
      throw new Error(`Memory not found: ${id}`);
    }
    return this.mapToMemory(rows[0]);
  }

  async deleteMemory(userId: string, id: string): Promise<void> {
    await db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, userId)));
  }

  async searchMemories(userId: string, query: string, opts?: SearchOptions): Promise<Memory[]> {
    // Split query into individual words and OR-match each (case-insensitive)
    const words = query.split(/\s+/).filter((w) => w.length > 0);
    const wordConditions = words.length > 0
      ? words.map((w) => ilike(memories.content, `%${w}%`))
      : [ilike(memories.content, `%${query}%`)];

    const conditions = [
      eq(memories.userId, userId),
      or(...wordConditions)!,
    ];

    if (opts?.minConfidence !== undefined) {
      conditions.push(gte(memories.confidenceScore, opts.minConfidence));
    }
    if (opts?.types && opts.types.length > 0) {
      conditions.push(inArray(memories.type, opts.types));
    }

    const limit = opts?.limit ?? 20;

    const rows = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(limit);

    return rows.map(this.mapToMemory);
  }

  async touchMemory(userId: string, id: string): Promise<void> {
    await db
      .update(memories)
      .set({ lastAccessedAt: new Date() })
      .where(and(eq(memories.id, id), eq(memories.userId, userId)));
  }

  async supersedeMemory(userId: string, oldId: string, newInput: CreateMemoryInput): Promise<Memory> {
    const [newMemory] = await this.addMemories(userId, [newInput]);

    await db
      .update(memories)
      .set({ supersededBy: newMemory.id, status: "archived", updatedAt: new Date() })
      .where(and(eq(memories.id, oldId), eq(memories.userId, userId)));

    return newMemory;
  }

  async addEvidence(userId: string, memoryId: string, input: CreateEvidenceInput): Promise<MemoryEvidence> {
    // Verify memory belongs to user
    const mem = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (mem.length === 0) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    const rows = await db
      .insert(memoryEvidence)
      .values({
        id: nanoid(),
        memoryId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        excerpt: input.excerpt,
        createdAt: new Date(),
      })
      .returning();

    return this.mapToEvidence(rows[0]);
  }

  async getEvidence(userId: string, memoryId: string): Promise<MemoryEvidence[]> {
    // Verify memory belongs to user
    const mem = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (mem.length === 0) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    const rows = await db
      .select()
      .from(memoryEvidence)
      .where(eq(memoryEvidence.memoryId, memoryId));

    return rows.map(this.mapToEvidence);
  }

  async getStats(userId: string): Promise<MemoryStats> {
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memories)
      .where(eq(memories.userId, userId));

    const byTypeResult = await db
      .select({
        type: memories.type,
        count: sql<number>`count(*)::int`,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .groupBy(memories.type);

    const byStatusResult = await db
      .select({
        status: memories.status,
        count: sql<number>`count(*)::int`,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .groupBy(memories.status);

    const byConfidenceResult = await db
      .select({
        level: memories.confidenceLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .groupBy(memories.confidenceLevel);

    const byType = {} as Record<string, number>;
    for (const row of byTypeResult) {
      byType[row.type] = row.count;
    }

    const byStatus = {} as Record<string, number>;
    for (const row of byStatusResult) {
      byStatus[row.status] = row.count;
    }

    const byConfidenceLevel = {} as Record<string, number>;
    for (const row of byConfidenceResult) {
      byConfidenceLevel[row.level] = row.count;
    }

    return {
      totalMemories: totalResult[0]?.count ?? 0,
      byType: byType as MemoryStats["byType"],
      byStatus: byStatus as MemoryStats["byStatus"],
      byConfidenceLevel: byConfidenceLevel as MemoryStats["byConfidenceLevel"],
    };
  }

  // --- Not implemented (later phases) ---

  async addConnections(userId: string, connections: CreateConnectionInput[]): Promise<MemoryConnection[]> {
    if (connections.length === 0) return [];

    // Verify all referenced memories belong to user
    const allMemoryIds = [...new Set(connections.flatMap((c) => [c.fromMemoryId, c.toMemoryId]))];
    const owned = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.userId, userId), inArray(memories.id, allMemoryIds)));

    const ownedIds = new Set(owned.map((m) => m.id));
    const valid = connections.filter((c) => ownedIds.has(c.fromMemoryId) && ownedIds.has(c.toMemoryId));
    if (valid.length === 0) return [];

    const values = valid.map((c) => ({
      id: `conn_${nanoid()}`,
      fromMemoryId: c.fromMemoryId,
      toMemoryId: c.toMemoryId,
      relationshipType: c.relationshipType,
      strength: c.strength,
      createdAt: new Date(),
    }));

    const rows = await db
      .insert(memoryConnections)
      .values(values)
      .onConflictDoNothing()
      .returning();

    return rows.map(this.mapToConnection);
  }

  async getConnections(userId: string, memoryId: string): Promise<MemoryConnection[]> {
    // Verify memory belongs to user
    const mem = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);
    if (mem.length === 0) throw new Error(`Memory not found: ${memoryId}`);

    const rows = await db
      .select({
        conn: memoryConnections,
      })
      .from(memoryConnections)
      .innerJoin(memories, or(
        and(eq(memoryConnections.fromMemoryId, memories.id), eq(memories.userId, userId)),
        and(eq(memoryConnections.toMemoryId, memories.id), eq(memories.userId, userId)),
      ))
      .where(or(
        eq(memoryConnections.fromMemoryId, memoryId),
        eq(memoryConnections.toMemoryId, memoryId),
      ));

    // Deduplicate (join may produce duplicates)
    const seen = new Set<string>();
    const result: MemoryConnection[] = [];
    for (const row of rows) {
      if (!seen.has(row.conn.id)) {
        seen.add(row.conn.id);
        result.push(this.mapToConnection(row.conn));
      }
    }
    return result;
  }

  async getGraph(userId: string, memoryId: string, depth: number): Promise<GraphResult> {
    // Recursive CTE for N-hop traversal, filtered by strength > 0.3
    const safeDepth = Math.min(Math.max(depth, 1), 5);

    const graphQuery = sql`
      WITH RECURSIVE graph AS (
        SELECT ${memoryConnections.id}, ${memoryConnections.fromMemoryId}, ${memoryConnections.toMemoryId},
               ${memoryConnections.relationshipType}, ${memoryConnections.strength}, ${memoryConnections.createdAt},
               1 AS depth
        FROM ${memoryConnections}
        WHERE (${memoryConnections.fromMemoryId} = ${memoryId} OR ${memoryConnections.toMemoryId} = ${memoryId})
          AND ${memoryConnections.strength} > 0.3
        UNION
        SELECT c.id, c.from_memory_id, c.to_memory_id, c.relationship_type, c.strength, c.created_at,
               g.depth + 1
        FROM memory_connections c
        INNER JOIN graph g ON (c.from_memory_id = g.to_memory_id OR c.from_memory_id = g.from_memory_id
                            OR c.to_memory_id = g.from_memory_id OR c.to_memory_id = g.to_memory_id)
        WHERE g.depth < ${safeDepth}
          AND c.strength > 0.3
          AND c.id != g.id
      )
      SELECT DISTINCT id, from_memory_id, to_memory_id, relationship_type, strength, created_at
      FROM graph
    `;

    const edgeRows = await db.execute(graphQuery) as unknown as {
      id: string; from_memory_id: string; to_memory_id: string;
      relationship_type: string; strength: number; created_at: Date;
    }[];

    const edges: MemoryConnection[] = edgeRows.map((r) => ({
      id: r.id,
      fromMemoryId: r.from_memory_id,
      toMemoryId: r.to_memory_id,
      relationshipType: r.relationship_type as MemoryConnection["relationshipType"],
      strength: r.strength,
      createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    }));

    // Collect all node IDs and load them
    const nodeIds = [...new Set(edges.flatMap((e) => [e.fromMemoryId, e.toMemoryId]))];
    if (!nodeIds.includes(memoryId)) nodeIds.push(memoryId);

    let nodes: Memory[] = [];
    if (nodeIds.length > 0) {
      const nodeRows = await db
        .select()
        .from(memories)
        .where(and(eq(memories.userId, userId), inArray(memories.id, nodeIds)));
      nodes = nodeRows.map(this.mapToMemory);
    }

    return { nodes, edges };
  }

  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    // Verify ownership through joined memories
    const conn = await db
      .select({ id: memoryConnections.id, fromMemoryId: memoryConnections.fromMemoryId })
      .from(memoryConnections)
      .innerJoin(memories, and(
        eq(memoryConnections.fromMemoryId, memories.id),
        eq(memories.userId, userId),
      ))
      .where(eq(memoryConnections.id, connectionId))
      .limit(1);

    if (conn.length === 0) throw new Error(`Connection not found: ${connectionId}`);

    await db.delete(memoryConnections).where(eq(memoryConnections.id, connectionId));
  }

  async loadQuestions(userId: string, filters?: QuestionFilters): Promise<Question[]> {
    const conditions = [eq(questions.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(questions.status, filters.status));
    }
    if (filters?.scope) {
      conditions.push(eq(questions.scope, filters.scope));
    }
    if (filters?.timing) {
      conditions.push(eq(questions.timing, filters.timing));
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const rows = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(desc(questions.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(this.mapToQuestion);
  }

  async addQuestion(userId: string, question: CreateQuestionInput, sourceMemoryIds: string[]): Promise<Question> {
    const now = new Date();
    const id = `q_${nanoid()}`;

    const rows = await db
      .insert(questions)
      .values({
        id,
        userId,
        content: question.content,
        context: question.context,
        curiosityType: question.curiosityType,
        curiosityScore: question.curiosityScore,
        timing: question.timing,
        scope: question.scope ?? null,
        status: "pending",
        answer: null,
        resolvedAt: null,
        createdAt: now,
      })
      .returning();

    if (sourceMemoryIds.length > 0) {
      await db.insert(questionMemoryLinks).values(
        sourceMemoryIds.map((memoryId) => ({
          id: nanoid(),
          questionId: id,
          memoryId,
          linkType: "triggered_by" as const,
          createdAt: now,
        }))
      );
    }

    return this.mapToQuestion(rows[0]);
  }

  async resolveQuestion(userId: string, id: string, resolution: QuestionResolution): Promise<Question> {
    const now = new Date();

    const rows = await db
      .update(questions)
      .set({
        answer: resolution.answer,
        resolvedAt: now,
        status: "resolved",
      })
      .where(and(eq(questions.id, id), eq(questions.userId, userId)))
      .returning();

    if (rows.length === 0) {
      throw new Error(`Question not found: ${id}`);
    }

    if (resolution.answeringMemoryId) {
      await db.insert(questionMemoryLinks).values({
        id: nanoid(),
        questionId: id,
        memoryId: resolution.answeringMemoryId,
        linkType: "answered_by",
        createdAt: now,
      });
    }

    return this.mapToQuestion(rows[0]);
  }

  async getQuestionsToSurface(userId: string, limit: number): Promise<Question[]> {
    const rows = await db
      .select()
      .from(questions)
      .where(and(eq(questions.userId, userId), eq(questions.status, "pending")))
      .orderBy(desc(questions.curiosityScore))
      .limit(limit);

    return rows.map(this.mapToQuestion);
  }

  async deleteQuestion(userId: string, id: string): Promise<void> {
    await db
      .delete(questions)
      .where(and(eq(questions.id, id), eq(questions.userId, userId)));
  }

  async loadIdentity(userId: string): Promise<IdentityDocument | null> {
    const rows = await db
      .select()
      .from(identityDocuments)
      .where(and(eq(identityDocuments.userId, userId), eq(identityDocuments.isActive, true)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToIdentityDocument(rows[0]);
  }

  async updateIdentity(userId: string, content: IdentityContent): Promise<IdentityDocument> {
    // Find max version for this user
    const maxResult = await db
      .select({ maxVersion: sql<number>`coalesce(max(${identityDocuments.version}), 0)` })
      .from(identityDocuments)
      .where(eq(identityDocuments.userId, userId));

    const nextVersion = (maxResult[0]?.maxVersion ?? 0) + 1;

    // Deactivate all previous versions
    await db
      .update(identityDocuments)
      .set({ isActive: false })
      .where(and(eq(identityDocuments.userId, userId), eq(identityDocuments.isActive, true)));

    // Insert new active version
    const rows = await db
      .insert(identityDocuments)
      .values({
        id: `idoc_${nanoid()}`,
        userId,
        version: nextVersion,
        content,
        isActive: true,
        generatedAt: new Date(),
      })
      .returning();

    return this.mapToIdentityDocument(rows[0]);
  }

  async listIdentityVersions(userId: string): Promise<IdentityDocument[]> {
    const rows = await db
      .select()
      .from(identityDocuments)
      .where(eq(identityDocuments.userId, userId))
      .orderBy(desc(identityDocuments.version));

    return rows.map(this.mapToIdentityDocument);
  }

  async saveReflection(userId: string, input: CreateReflectionInput): Promise<Reflection> {
    const rows = await db
      .insert(reflections)
      .values({
        id: nanoid(),
        userId,
        sessionId: input.sessionId,
        memoriesExtracted: input.memoriesExtracted,
        questionsGenerated: input.questionsGenerated,
        modelUsed: input.modelUsed,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
      })
      .returning();

    return this.mapToReflection(rows[0]);
  }

  async loadReflections(userId: string, limit?: number): Promise<Reflection[]> {
    const rows = await db
      .select()
      .from(reflections)
      .where(eq(reflections.userId, userId))
      .orderBy(desc(reflections.createdAt))
      .limit(limit ?? 20);

    return rows.map(this.mapToReflection);
  }

  // --- Private helpers ---

  private mapToMemory(record: MemoryRecord): Memory {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type as Memory["type"],
      content: record.content,
      confidenceScore: record.confidenceScore,
      confidenceLevel: record.confidenceLevel as Memory["confidenceLevel"],
      tags: (record.tags ?? []) as string[],
      scope: record.scope,
      status: record.status as Memory["status"],
      supersededBy: record.supersededBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAccessedAt: record.lastAccessedAt,
    };
  }

  private mapToReflection(record: ReflectionRecord): Reflection {
    return {
      id: record.id,
      userId: record.userId,
      sessionId: record.sessionId,
      memoriesExtracted: record.memoriesExtracted,
      questionsGenerated: record.questionsGenerated,
      modelUsed: record.modelUsed,
      metadata: (record.metadata ?? {}) as Record<string, unknown>,
      createdAt: record.createdAt,
    };
  }

  private mapToConnection(record: MemoryConnectionRecord): MemoryConnection {
    return {
      id: record.id,
      fromMemoryId: record.fromMemoryId,
      toMemoryId: record.toMemoryId,
      relationshipType: record.relationshipType as MemoryConnection["relationshipType"],
      strength: record.strength,
      createdAt: record.createdAt,
    };
  }

  private mapToQuestion(record: QuestionRecord): Question {
    return {
      id: record.id,
      userId: record.userId,
      content: record.content,
      context: record.context,
      curiosityType: record.curiosityType as Question["curiosityType"],
      curiosityScore: record.curiosityScore,
      timing: record.timing as Question["timing"],
      scope: record.scope,
      status: record.status as Question["status"],
      answer: record.answer,
      resolvedAt: record.resolvedAt,
      createdAt: record.createdAt,
    };
  }

  private mapToIdentityDocument(record: IdentityDocumentRecord): IdentityDocument {
    return {
      id: record.id,
      userId: record.userId,
      version: record.version,
      content: record.content as IdentityContent,
      isActive: record.isActive,
      generatedAt: record.generatedAt,
    };
  }

  private mapToEvidence(record: MemoryEvidenceRecord): MemoryEvidence {
    return {
      id: record.id,
      memoryId: record.memoryId,
      sourceType: record.sourceType as MemoryEvidence["sourceType"],
      sourceId: record.sourceId,
      excerpt: record.excerpt,
      createdAt: record.createdAt,
    };
  }
}
