import { db } from "@/lib/db";
import { agents, items, sessions } from "@/lib/db/schema";
import type { AgentRecord, ItemRecord } from "@/lib/db/schema";
import { eq, asc, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
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
    agentConfigId: record.agentConfigId,
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
  async findById(id: string, userId: string): Promise<Agent | null> {
    const [record] = await db.select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return record ? parseAgentRecord(record) : null;
  }

  /**
   * Find an agent by ID with its items
   */
  async findByIdWithItems(id: string, userId: string): Promise<AgentWithItems | null> {
    const agent = await this.findById(id, userId);
    if (!agent) {
      return null;
    }

    const agentItems = await db
      .select()
      .from(items)
      .where(eq(items.agentId, id))
      .orderBy(asc(items.sequence));

    return {
      ...agent,
      items: agentItems.map(parseItemRecord),
    };
  }

  /**
   * Find all agents for a session
   */
  async findBySessionId(sessionId: string, userId: string): Promise<Agent[]> {
    const records = await db
      .select()
      .from(agents)
      .where(and(eq(agents.sessionId, sessionId), eq(agents.userId, userId)))
      .orderBy(asc(agents.createdAt));
    return records.map(parseAgentRecord);
  }

  /**
   * Find all agents for a session with their items
   */
  async findBySessionIdWithItems(sessionId: string, userId: string, itemsLimit?: number): Promise<AgentWithItems[]> {
    const sessionAgents = await this.findBySessionId(sessionId, userId);

    const results: AgentWithItems[] = [];
    for (const agent of sessionAgents) {
      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(items)
        .where(eq(items.agentId, agent.id));
      const totalCount = Number(countResult?.count ?? 0);

      let agentItems: ItemRecord[];
      if (itemsLimit && totalCount > itemsLimit) {
        // Fetch last N items (DESC then reverse)
        const records = await db
          .select()
          .from(items)
          .where(eq(items.agentId, agent.id))
          .orderBy(desc(items.sequence))
          .limit(itemsLimit);
        agentItems = records.reverse();
      } else {
        agentItems = await db
          .select()
          .from(items)
          .where(eq(items.agentId, agent.id))
          .orderBy(asc(items.sequence));
      }

      results.push({
        ...agent,
        items: agentItems.map(parseItemRecord),
        itemsTotalCount: totalCount,
      });
    }

    return results;
  }

  /**
   * Find all agents (scoped to user)
   */
  async findAll(userId: string): Promise<Agent[]> {
    const records = await db.select().from(agents).where(eq(agents.userId, userId)).orderBy(asc(agents.createdAt));
    return records.map(parseAgentRecord);
  }

  /**
   * Check if session exists (scoped to user)
   */
  async sessionExists(sessionId: string, userId: string): Promise<boolean> {
    const [session] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    return !!session;
  }

  /**
   * Create a new agent
   */
  async create(data: AgentCreate, userId: string): Promise<Agent> {
    const id = nanoid();

    await db.insert(agents).values({
      id,
      userId,
      agentConfigId: data.agentConfigId,
      sessionId: data.sessionId,
      name: data.name,
      task: data.task || null,
      systemPrompt: data.systemPrompt || null,
      model: data.model || null,
      config: data.config || null,
      status: "pending",
    });

    return (await this.findById(id, userId))!;
  }

  /**
   * Update an agent
   */
  async update(id: string, data: AgentUpdate, userId: string): Promise<Agent | null> {
    const existing = await this.findById(id, userId);
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
      await db.update(agents).set(updateData).where(and(eq(agents.id, id), eq(agents.userId, userId)));
    }

    return this.findById(id, userId);
  }

  /**
   * Update agent status
   */
  async updateStatus(id: string, status: AgentStatus, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return false;
    }

    await db
      .update(agents)
      .set({ status })
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return true;
  }

  /**
   * Delete an agent (cascades to items)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return false;
    }

    await db.delete(agents).where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return true;
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
