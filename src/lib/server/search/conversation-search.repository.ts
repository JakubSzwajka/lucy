import { db } from "@/lib/server/db";
import { items, agents, sessions } from "@/lib/server/db/schema";
import type { ItemRecord } from "@/lib/server/db/schema";
import { eq, ne, and, or, like, asc, desc, lt, gt } from "drizzle-orm";
import type {
  ConversationSearchResult,
  ConversationSearchOptions,
  ContextItem,
} from "./types";

// ============================================================================
// Conversation Search Repository
// ============================================================================

function getItemContent(record: ItemRecord): string {
  switch (record.type) {
    case "message":
      return record.content || "";
    case "tool_call":
      return record.toolName || "";
    case "tool_result":
      return record.toolOutput || "";
    case "reasoning":
      return record.reasoningContent || "";
    default:
      return "";
  }
}

function toContextItem(record: ItemRecord): ContextItem {
  return {
    id: record.id,
    type: record.type,
    sequence: record.sequence,
    content: getItemContent(record),
    role: record.role || undefined,
    toolName: record.toolName || undefined,
    createdAt: record.createdAt,
  };
}

export class ConversationSearchRepository {
  async searchWithContext(
    query: string,
    userId: string,
    options: ConversationSearchOptions = {}
  ): Promise<ConversationSearchResult[]> {
    const {
      limit = 5,
      contextWindow = 3,
      excludeSessionId,
      itemTypes,
    } = options;

    const searchPattern = `%${query}%`;

    const searchConditions = [];

    const typesToSearch = itemTypes || ["message", "tool_call", "tool_result", "reasoning"];

    if (typesToSearch.includes("message")) {
      searchConditions.push(
        and(eq(items.type, "message"), like(items.content, searchPattern))
      );
    }
    if (typesToSearch.includes("tool_call")) {
      searchConditions.push(
        and(eq(items.type, "tool_call"), like(items.toolName, searchPattern))
      );
    }
    if (typesToSearch.includes("tool_result")) {
      searchConditions.push(
        and(eq(items.type, "tool_result"), like(items.toolOutput, searchPattern))
      );
    }
    if (typesToSearch.includes("reasoning")) {
      searchConditions.push(
        and(eq(items.type, "reasoning"), like(items.reasoningContent, searchPattern))
      );
    }

    if (searchConditions.length === 0) {
      return [];
    }

    let whereCondition = or(...searchConditions);

    // Scope to user
    whereCondition = and(whereCondition, eq(agents.userId, userId));

    if (excludeSessionId) {
      whereCondition = and(
        whereCondition,
        ne(agents.sessionId, excludeSessionId)
      );
    }

    const matchedRecords = await db
      .select({
        item: items,
        sessionId: agents.sessionId,
        sessionTitle: sessions.title,
      })
      .from(items)
      .innerJoin(agents, eq(items.agentId, agents.id))
      .innerJoin(sessions, eq(agents.sessionId, sessions.id))
      .where(whereCondition!)
      .orderBy(desc(items.createdAt))
      .limit(limit * 2);

    const results: ConversationSearchResult[] = [];
    const seenSessions = new Set<string>();

    for (const record of matchedRecords) {
      if (seenSessions.has(record.sessionId)) {
        continue;
      }
      seenSessions.add(record.sessionId);

      const contextBefore = await this.getContextBefore(
        record.item.agentId,
        record.item.sequence,
        contextWindow
      );
      const contextAfter = await this.getContextAfter(
        record.item.agentId,
        record.item.sequence,
        contextWindow
      );

      results.push({
        sessionId: record.sessionId,
        sessionTitle: record.sessionTitle,
        matchedItem: {
          id: record.item.id,
          type: record.item.type,
          content: getItemContent(record.item),
          role: record.item.role || undefined,
          toolName: record.item.toolName || undefined,
          sequence: record.item.sequence,
          createdAt: record.item.createdAt,
        },
        context: {
          before: contextBefore,
          after: contextAfter,
        },
      });

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  private async getContextBefore(
    agentId: string,
    sequence: number,
    count: number
  ): Promise<ContextItem[]> {
    const records = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.agentId, agentId),
          lt(items.sequence, sequence)
        )
      )
      .orderBy(desc(items.sequence))
      .limit(count);

    return records.reverse().map(toContextItem);
  }

  private async getContextAfter(
    agentId: string,
    sequence: number,
    count: number
  ): Promise<ContextItem[]> {
    const records = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.agentId, agentId),
          gt(items.sequence, sequence)
        )
      )
      .orderBy(asc(items.sequence))
      .limit(count);

    return records.map(toContextItem);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ConversationSearchRepository | null = null;

export function getConversationSearchRepository(): ConversationSearchRepository {
  if (!instance) {
    instance = new ConversationSearchRepository();
  }
  return instance;
}
