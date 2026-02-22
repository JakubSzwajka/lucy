import type { ItemType } from "@/lib/server/db/schema";

// ============================================================================
// Conversation Search Types
// ============================================================================

export interface ContextItem {
  id: string;
  type: ItemType;
  sequence: number;
  content: string;
  role?: string;
  toolName?: string;
  createdAt: Date;
}

export interface ConversationSearchResult {
  sessionId: string;
  sessionTitle: string;
  matchedItem: {
    id: string;
    type: ItemType;
    content: string;
    role?: string;
    toolName?: string;
    sequence: number;
    createdAt: Date;
  };
  context: {
    before: ContextItem[];
    after: ContextItem[];
  };
}

export interface ConversationSearchOptions {
  /** Maximum number of results. Default: 5 */
  limit?: number;
  /** Number of items before/after matched item. Default: 3 */
  contextWindow?: number;
  /** Session ID to exclude from results (to avoid circular references) */
  excludeSessionId?: string;
  /** Filter to specific item types */
  itemTypes?: ItemType[];
}
