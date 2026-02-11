import type { ConversationSearchRepository } from "@/lib/services/conversation-search";
import type {
  ConversationSearchResult,
  ConversationSearchOptions,
} from "./types";

/**
 * Client for searching past conversations.
 * Thin wrapper over ConversationSearchRepository for consistent integration pattern.
 */
export class ConversationsClient {
  constructor(private repository: ConversationSearchRepository) {}

  /**
   * Search past conversations for matching content.
   *
   * @param query - Search query (keywords)
   * @param options - Search options
   * @returns Array of matching conversation results with context
   */
  search(
    query: string,
    options?: ConversationSearchOptions
  ): ConversationSearchResult[] {
    return this.repository.searchWithContext(query, options);
  }
}
