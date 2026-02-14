import { db } from "@/lib/db";
import { sessions, agents } from "@/lib/db/schema";
import type { SessionRecord } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
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
    title: record.title,
    status: record.status as SessionStatus,
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
   * Find all sessions ordered by updatedAt descending (scoped to user)
   */
  async findAll(userId: string): Promise<Session[]> {
    const records = await db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.updatedAt));
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
    });

    // Create root agent for the session
    await db.insert(agents).values({
      id: agentId,
      userId,
      sessionId,
      name: data.agentName || "assistant",
      systemPrompt: data.systemPrompt || null,
      model: data.model || null,
      agentConfigId: data.agentConfigId || null,
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
