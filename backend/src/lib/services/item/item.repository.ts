import { db } from "@/lib/db";
import { items, agents, sessions } from "@/lib/db/schema";
import type { NewItem, ItemRecord } from "@/lib/db/schema";
import { eq, asc, sql, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  Item,
  MessageItem,
  ToolCallItem,
  ToolResultItem,
  ReasoningItem,
  ToolCallStatus,
} from "@/types";

// ============================================================================
// Item Repository Types
// ============================================================================

export interface CreateMessageData {
  type: "message";
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CreateToolCallData {
  type: "tool_call";
  callId: string;
  toolName: string;
  toolArgs?: Record<string, unknown> | null;
  toolStatus?: ToolCallStatus;
}

export interface CreateToolResultData {
  type: "tool_result";
  callId: string;
  toolOutput?: string | null;
  toolError?: string | null;
}

export interface CreateReasoningData {
  type: "reasoning";
  reasoningContent: string;
  reasoningSummary?: string | null;
}

export type CreateItemData =
  | CreateMessageData
  | CreateToolCallData
  | CreateToolResultData
  | CreateReasoningData;

// ============================================================================
// Item Repository
// ============================================================================

/**
 * Transform database record to typed Item
 */
function parseItemRecord(record: ItemRecord): Item {
  switch (record.type) {
    case "message":
      return {
        id: record.id,
        agentId: record.agentId,
        sequence: record.sequence,
        type: "message",
        role: record.role!,
        content: record.content!,
        createdAt: record.createdAt,
      } as MessageItem;

    case "tool_call":
      return {
        id: record.id,
        agentId: record.agentId,
        sequence: record.sequence,
        type: "tool_call",
        callId: record.callId!,
        toolName: record.toolName!,
        toolArgs: record.toolArgs,
        toolStatus: record.toolStatus!,
        createdAt: record.createdAt,
      } as ToolCallItem;

    case "tool_result":
      return {
        id: record.id,
        agentId: record.agentId,
        sequence: record.sequence,
        type: "tool_result",
        callId: record.callId!,
        toolOutput: record.toolOutput,
        toolError: record.toolError,
        createdAt: record.createdAt,
      } as ToolResultItem;

    case "reasoning":
      return {
        id: record.id,
        agentId: record.agentId,
        sequence: record.sequence,
        type: "reasoning",
        reasoningSummary: record.reasoningSummary,
        reasoningContent: record.reasoningContent!,
        createdAt: record.createdAt,
      } as ReasoningItem;

    default:
      throw new Error(`Unknown item type: ${record.type}`);
  }
}

/**
 * Repository for item data access
 */
export class ItemRepository {
  async findById(id: string): Promise<Item | null> {
    const [record] = await db.select().from(items).where(eq(items.id, id));
    return record ? parseItemRecord(record) : null;
  }

  async findByAgentId(agentId: string): Promise<Item[]> {
    const records = await db
      .select()
      .from(items)
      .where(eq(items.agentId, agentId))
      .orderBy(asc(items.sequence));
    return records.map(parseItemRecord);
  }

  async findByCallId(callId: string): Promise<Item | null> {
    const [record] = await db.select().from(items).where(eq(items.callId, callId));
    return record ? parseItemRecord(record) : null;
  }

  async getNextSequence(agentId: string): Promise<number> {
    const [maxSeq] = await db
      .select({ max: sql<number>`MAX(${items.sequence})` })
      .from(items)
      .where(eq(items.agentId, agentId));
    return (maxSeq?.max ?? -1) + 1;
  }

  async create(agentId: string, data: CreateItemData): Promise<Item> {
    const id = uuidv4();
    const sequence = await this.getNextSequence(agentId);

    let itemData: NewItem;

    switch (data.type) {
      case "message":
        itemData = {
          id,
          agentId,
          sequence,
          type: "message",
          role: data.role,
          content: data.content,
        };
        break;

      case "tool_call":
        itemData = {
          id,
          agentId,
          sequence,
          type: "tool_call",
          callId: data.callId,
          toolName: data.toolName,
          toolArgs: data.toolArgs || null,
          toolStatus: data.toolStatus || "pending",
        };
        break;

      case "tool_result":
        itemData = {
          id,
          agentId,
          sequence,
          type: "tool_result",
          callId: data.callId,
          toolOutput: data.toolOutput || null,
          toolError: data.toolError || null,
        };
        break;

      case "reasoning":
        itemData = {
          id,
          agentId,
          sequence,
          type: "reasoning",
          reasoningSummary: data.reasoningSummary || null,
          reasoningContent: data.reasoningContent,
        };
        break;
    }

    await db.insert(items).values(itemData);
    return (await this.findById(id))!;
  }

  async updateToolCallStatus(callId: string, status: ToolCallStatus): Promise<boolean> {
    const existing = await this.findByCallId(callId);
    if (!existing) {
      return false;
    }

    await db
      .update(items)
      .set({ toolStatus: status })
      .where(eq(items.callId, callId));
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    await db.delete(items).where(eq(items.id, id));
    return true;
  }

  /**
   * Check if agent exists (scoped to user via agent's userId)
   */
  async agentExists(agentId: string, userId: string): Promise<{ exists: boolean; sessionId?: string }> {
    const [agent] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
    return agent ? { exists: true, sessionId: agent.sessionId } : { exists: false };
  }

  async updateSessionTimestamp(sessionId: string): Promise<void> {
    await db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async getSessionTitle(sessionId: string): Promise<string | null> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    return session?.title || null;
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await db.update(sessions)
      .set({ title })
      .where(eq(sessions.id, sessionId));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ItemRepository | null = null;

export function getItemRepository(): ItemRepository {
  if (!instance) {
    instance = new ItemRepository();
  }
  return instance;
}
