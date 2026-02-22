# Search

Conversation search and context retrieval across sessions.

## Public API

- `ConversationSearchRepository`, `getConversationSearchRepository()` — full-text search over items
- Types: `ConversationSearchResult`, `ConversationSearchOptions`, `ContextItem`

## Responsibility Boundary

Owns search queries against the items table. Does not own item persistence — that belongs in `domain/item/`.
