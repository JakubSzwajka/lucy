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
  findById(id: string, userId: string): Session | null {
    const [record] = db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).all();
    return record ? parseSessionRecord(record) : null;
  }

  /**
   * Find all sessions ordered by updatedAt descending (scoped to user)
   */
  findAll(userId: string): Session[] {
    const records = db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.updatedAt)).all();
    return records.map(parseSessionRecord);
  }

  /**
   * Create a new session with a root agent
   */
  create(data: SessionCreate & { agentName?: string; systemPrompt?: string; model?: string }, userId: string): Session {
    const sessionId = uuidv4();
    const agentId = uuidv4();

    // Create session
    db.insert(sessions).values({
      id: sessionId,
      userId,
      title: data.title || "New Chat",
      rootAgentId: agentId,
    }).run();

    // Create root agent for the session
    db.insert(agents).values({
      id: agentId,
      userId,
      sessionId,
      name: data.agentName || "assistant",
      systemPrompt: data.systemPrompt || null,
      model: data.model || null,
      status: "pending",
    }).run();

    return this.findById(sessionId, userId)!;
  }

  /**
   * Update a session
   */
  update(id: string, data: SessionUpdate, userId: string): Session | null {
    const existing = this.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;

    db.update(sessions).set(updateData).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).run();

    return this.findById(id, userId);
  }

  /**
   * Delete a session (cascades to agents and items)
   */
  delete(id: string, userId: string): boolean {
    const result = db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).run();
    return result.changes > 0;
  }

  /**
   * Update session title
   */
  updateTitle(id: string, title: string, userId: string): void {
    db.update(sessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .run();
  }

  /**
   * Update session timestamp
   */
  touch(id: string, userId: string): void {
    db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .run();
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
