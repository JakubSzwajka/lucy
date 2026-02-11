import { db, items, agents, sessions, NewItem, ItemRecord } from "@/lib/db";
import { eq, asc, sql } from "drizzle-orm";
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
  /**
   * Find an item by ID
   */
  findById(id: string): Item | null {
    const [record] = db.select().from(items).where(eq(items.id, id)).all();
    return record ? parseItemRecord(record) : null;
  }

  /**
   * Find all items for an agent, ordered by sequence
   */
  findByAgentId(agentId: string): Item[] {
    const records = db
      .select()
      .from(items)
      .where(eq(items.agentId, agentId))
      .orderBy(asc(items.sequence))
      .all();
    return records.map(parseItemRecord);
  }

  /**
   * Find item by callId (for tool_call and tool_result)
   */
  findByCallId(callId: string): Item | null {
    const [record] = db.select().from(items).where(eq(items.callId, callId)).all();
    return record ? parseItemRecord(record) : null;
  }

  /**
   * Get the next sequence number for an agent
   */
  getNextSequence(agentId: string): number {
    const [maxSeq] = db
      .select({ max: sql<number>`MAX(${items.sequence})` })
      .from(items)
      .where(eq(items.agentId, agentId))
      .all();
    return (maxSeq?.max ?? -1) + 1;
  }

  /**
   * Create a new item
   */
  create(agentId: string, data: CreateItemData): Item {
    const id = uuidv4();
    const sequence = this.getNextSequence(agentId);

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

    db.insert(items).values(itemData).run();
    return this.findById(id)!;
  }

  /**
   * Update tool call status
   */
  updateToolCallStatus(callId: string, status: ToolCallStatus): boolean {
    const result = db
      .update(items)
      .set({ toolStatus: status })
      .where(eq(items.callId, callId))
      .run();
    return result.changes > 0;
  }

  /**
   * Delete an item
   */
  delete(id: string): boolean {
    const result = db.delete(items).where(eq(items.id, id)).run();
    return result.changes > 0;
  }

  /**
   * Check if agent exists
   */
  agentExists(agentId: string): { exists: boolean; sessionId?: string } {
    const [agent] = db.select().from(agents).where(eq(agents.id, agentId)).all();
    return agent ? { exists: true, sessionId: agent.sessionId } : { exists: false };
  }

  /**
   * Update session timestamp
   */
  updateSessionTimestamp(sessionId: string): void {
    db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  /**
   * Get session title
   */
  getSessionTitle(sessionId: string): string | null {
    const [session] = db.select().from(sessions).where(eq(sessions.id, sessionId)).all();
    return session?.title || null;
  }

  /**
   * Update session title
   */
  updateSessionTitle(sessionId: string, title: string): void {
    db.update(sessions)
      .set({ title })
      .where(eq(sessions.id, sessionId))
      .run();
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
