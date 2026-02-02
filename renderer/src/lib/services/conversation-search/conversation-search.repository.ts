import { db, items, agents, sessions, ItemRecord } from "@/lib/db";
import { eq, ne, and, or, like, asc, desc, sql, lt, gt } from "drizzle-orm";
import type {
  ConversationSearchResult,
  ConversationSearchOptions,
  ContextItem,
} from "./types";

// ============================================================================
// Conversation Search Repository
// ============================================================================

/**
 * Extract searchable content from an item record based on its type
 */
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

/**
 * Transform an item record to a context item
 */
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

/**
 * Repository for searching past conversations
 */
export class ConversationSearchRepository {
  /**
   * Search for items matching the query with surrounding context
   */
  searchWithContext(
    query: string,
    options: ConversationSearchOptions = {}
  ): ConversationSearchResult[] {
    const {
      limit = 5,
      contextWindow = 3,
      excludeSessionId,
      itemTypes,
    } = options;

    // Build search pattern for LIKE queries
    const searchPattern = `%${query}%`;

    // Build type-specific search conditions
    const searchConditions = [];

    // Only search specified types, or all types if not specified
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

    // Build the base condition: match any search condition
    let whereCondition = or(...searchConditions);

    // Exclude current session if specified
    if (excludeSessionId) {
      whereCondition = and(
        whereCondition,
        ne(agents.sessionId, excludeSessionId)
      );
    }

    // Execute search query with joins
    const matchedRecords = db
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
      .limit(limit * 2) // Fetch more to account for potential duplicates
      .all();

    // Process results and add context
    const results: ConversationSearchResult[] = [];
    const seenSessions = new Set<string>();

    for (const record of matchedRecords) {
      // Limit to one result per session for variety
      if (seenSessions.has(record.sessionId)) {
        continue;
      }
      seenSessions.add(record.sessionId);

      // Fetch context items
      const contextBefore = this.getContextBefore(
        record.item.agentId,
        record.item.sequence,
        contextWindow
      );
      const contextAfter = this.getContextAfter(
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

  /**
   * Get context items before the matched item
   */
  private getContextBefore(
    agentId: string,
    sequence: number,
    count: number
  ): ContextItem[] {
    const records = db
      .select()
      .from(items)
      .where(
        and(
          eq(items.agentId, agentId),
          lt(items.sequence, sequence)
        )
      )
      .orderBy(desc(items.sequence))
      .limit(count)
      .all();

    // Reverse to get chronological order
    return records.reverse().map(toContextItem);
  }

  /**
   * Get context items after the matched item
   */
  private getContextAfter(
    agentId: string,
    sequence: number,
    count: number
  ): ContextItem[] {
    const records = db
      .select()
      .from(items)
      .where(
        and(
          eq(items.agentId, agentId),
          gt(items.sequence, sequence)
        )
      )
      .orderBy(asc(items.sequence))
      .limit(count)
      .all();

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
