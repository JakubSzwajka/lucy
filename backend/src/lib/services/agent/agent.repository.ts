import { db } from "@/lib/db";
import { agents, items, sessions } from "@/lib/db/schema";
import type { AgentRecord, ItemRecord } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Repository } from "../repository.types";
import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  AgentStatus,
  AgentWithItems,
  Item,
} from "@/types";

// ============================================================================
// Agent Repository
// ============================================================================

/**
 * Transform database record to API type
 */
function parseAgentRecord(record: AgentRecord): Agent {
  return {
    id: record.id,
    sessionId: record.sessionId,
    parentId: record.parentId,
    sourceCallId: record.sourceCallId,
    name: record.name,
    task: record.task,
    systemPrompt: record.systemPrompt,
    model: record.model,
    config: record.config,
    status: record.status as AgentStatus,
    waitingForCallId: record.waitingForCallId,
    result: record.result,
    error: record.error,
    turnCount: record.turnCount,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  };
}

/**
 * Transform item record to typed Item (simplified for internal use)
 */
function parseItemRecord(record: ItemRecord): Item {
  return record as unknown as Item;
}

/**
 * Repository for agent data access
 */
export class AgentRepository implements Repository<Agent, AgentCreate, AgentUpdate> {
  /**
   * Find an agent by ID (scoped to user)
   */
  findById(id: string, userId: string): Agent | null {
    const [record] = db.select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, userId))).all();
    return record ? parseAgentRecord(record) : null;
  }

  /**
   * Find an agent by ID with its items
   */
  findByIdWithItems(id: string, userId: string): AgentWithItems | null {
    const agent = this.findById(id, userId);
    if (!agent) {
      return null;
    }

    const agentItems = db
      .select()
      .from(items)
      .where(eq(items.agentId, id))
      .orderBy(asc(items.sequence))
      .all();

    return {
      ...agent,
      items: agentItems.map(parseItemRecord),
    };
  }

  /**
   * Find all agents for a session
   */
  findBySessionId(sessionId: string, userId: string): Agent[] {
    const records = db
      .select()
      .from(agents)
      .where(and(eq(agents.sessionId, sessionId), eq(agents.userId, userId)))
      .orderBy(asc(agents.createdAt))
      .all();
    return records.map(parseAgentRecord);
  }

  /**
   * Find all agents for a session with their items
   */
  findBySessionIdWithItems(sessionId: string, userId: string): AgentWithItems[] {
    const sessionAgents = this.findBySessionId(sessionId, userId);

    return sessionAgents.map((agent) => {
      const agentItems = db
        .select()
        .from(items)
        .where(eq(items.agentId, agent.id))
        .orderBy(asc(items.sequence))
        .all();

      return {
        ...agent,
        items: agentItems.map(parseItemRecord),
      };
    });
  }

  /**
   * Find all agents (scoped to user)
   */
  findAll(userId: string): Agent[] {
    const records = db.select().from(agents).where(eq(agents.userId, userId)).orderBy(asc(agents.createdAt)).all();
    return records.map(parseAgentRecord);
  }

  /**
   * Check if session exists (scoped to user)
   */
  sessionExists(sessionId: string, userId: string): boolean {
    const [session] = db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).all();
    return !!session;
  }

  /**
   * Create a new agent
   */
  create(data: AgentCreate, userId: string): Agent {
    const id = uuidv4();

    db.insert(agents).values({
      id,
      userId,
      sessionId: data.sessionId,
      parentId: data.parentId || null,
      sourceCallId: data.sourceCallId || null,
      name: data.name,
      task: data.task || null,
      systemPrompt: data.systemPrompt || null,
      model: data.model || null,
      config: data.config || null,
      status: "pending",
    }).run();

    return this.findById(id, userId)!;
  }

  /**
   * Update an agent
   */
  update(id: string, data: AgentUpdate, userId: string): Agent | null {
    const existing = this.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.waitingForCallId !== undefined) updateData.waitingForCallId = data.waitingForCallId;
    if (data.result !== undefined) updateData.result = data.result;
    if (data.error !== undefined) updateData.error = data.error;
    if (data.turnCount !== undefined) updateData.turnCount = data.turnCount;
    if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    if (Object.keys(updateData).length > 0) {
      db.update(agents).set(updateData).where(and(eq(agents.id, id), eq(agents.userId, userId))).run();
    }

    return this.findById(id, userId);
  }

  /**
   * Update agent status
   */
  updateStatus(id: string, status: AgentStatus, userId: string): boolean {
    const result = db
      .update(agents)
      .set({ status })
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .run();
    return result.changes > 0;
  }

  /**
   * Delete an agent (cascades to items)
   */
  delete(id: string, userId: string): boolean {
    const result = db.delete(agents).where(and(eq(agents.id, id), eq(agents.userId, userId))).run();
    return result.changes > 0;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AgentRepository | null = null;

export function getAgentRepository(): AgentRepository {
  if (!instance) {
    instance = new AgentRepository();
  }
  return instance;
}
