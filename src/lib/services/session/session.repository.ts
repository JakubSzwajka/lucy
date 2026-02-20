import { db } from "@/lib/db";
import { sessions, agents } from "@/lib/db/schema";
import type { SessionRecord } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Repository } from "../repository.types";
import type { Session, SessionCreate, SessionUpdate, SessionStatus } from "@/types";

// ============================================================================
// Session Repository
// ============================================================================

/**
 * Transform database record to API type
 */
function parseSessionRecord(record: SessionRecord): Session {
  return {
    id: record.id,
    userId: record.userId,
    rootAgentId: record.rootAgentId,
    agentConfigId: record.agentConfigId,
    parentSessionId: record.parentSessionId,
    sourceCallId: record.sourceCallId,
    title: record.title,
    status: record.status as SessionStatus,
    isPinned: record.isPinned,
    reflectionTokenCount: record.reflectionTokenCount,
    lastReflectionItemCount: record.lastReflectionItemCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Repository for session data access
 */
export class SessionRepository implements Repository<Session, SessionCreate, SessionUpdate> {
  /**
   * Find a session by ID (scoped to user)
   */
  async findById(id: string, userId: string): Promise<Session | null> {
    const [record] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    return record ? parseSessionRecord(record) : null;
  }

  /**
   * Find all top-level sessions ordered by isPinned first, then updatedAt descending (scoped to user).
   * Excludes child sessions (those with a parentSessionId).
   */
  async findAll(userId: string): Promise<Session[]> {
    const records = await db.select().from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.parentSessionId))).orderBy(desc(sessions.isPinned), desc(sessions.updatedAt));
    return records.map(parseSessionRecord);
  }

  /**
   * Find child sessions of a given parent session (scoped to user)
   */
  async findByParentSessionId(parentSessionId: string, userId: string): Promise<Session[]> {
    const records = await db.select().from(sessions).where(and(eq(sessions.parentSessionId, parentSessionId), eq(sessions.userId, userId))).orderBy(desc(sessions.createdAt));
    return records.map(parseSessionRecord);
  }

  /**
   * Create a new session with a root agent
   */
  async create(data: SessionCreate & { agentName?: string; systemPrompt?: string; model?: string; agentConfigId?: string }, userId: string): Promise<Session> {
    const sessionId = uuidv4();
    const agentId = uuidv4();

    // Create session
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      title: data.title || "New Chat",
      rootAgentId: agentId,
      agentConfigId: data.agentConfigId || null,
      parentSessionId: data.parentSessionId || null,
      sourceCallId: data.sourceCallId || null,
    });

    // Create root agent for the session
    await db.insert(agents).values({
      id: agentId,
      userId,
      sessionId,
      name: data.agentName || "assistant",
      systemPrompt: data.systemPrompt || null,
      model: data.model || null,
      agentConfigId: data.agentConfigId!,
      status: "pending",
    });

    return (await this.findById(sessionId, userId))!;
  }

  /**
   * Update a session
   */
  async update(id: string, data: SessionUpdate, userId: string): Promise<Session | null> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.reflectionTokenCount !== undefined) updateData.reflectionTokenCount = data.reflectionTokenCount;
    if (data.lastReflectionItemCount !== undefined) updateData.lastReflectionItemCount = data.lastReflectionItemCount;

    await db.update(sessions).set(updateData).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));

    return this.findById(id, userId);
  }

  /**
   * Delete a session (cascades to agents and items)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return false;
    }

    await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    return true;
  }

  /**
   * Update session title
   */
  async updateTitle(id: string, title: string, userId: string): Promise<void> {
    await db.update(sessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
  }

  /**
   * Update session timestamp
   */
  async touch(id: string, userId: string): Promise<void> {
    await db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  if (!instance) {
    instance = new SessionRepository();
  }
  return instance;
}
