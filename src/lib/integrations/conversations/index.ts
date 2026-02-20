/**
 * Conversations Integration
 *
 * Provides search capability over past Lucy conversations.
 * Always available - uses internal database.
 */

import { getConversationSearchRepository } from "@/lib/services/conversation-search";
import { ConversationsClient } from "./client";

// Re-export client and types
export { ConversationsClient } from "./client";
export type {
  ConversationSearchResult,
  ConversationSearchOptions,
  ContextItem,
} from "./types";

/**
 * Conversations integration definition.
 */
export const conversationsIntegration = {
  id: "conversations",
  name: "Conversations",
  description: "Search past Lucy conversations",

  /**
   * Conversations is always configured (uses internal database).
   */
  isConfigured: () => true,

  /**
   * Create a ConversationsClient instance.
   */
  createClient: (): ConversationsClient => {
    return new ConversationsClient(getConversationSearchRepository());
  },
};
