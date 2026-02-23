# Sessions

Conversation data model — sessions, agents, and items (the message/tool-call history).

## Public API

- `SessionService`, `getSessionService()` — session CRUD, title generation, archival
- `AgentService`, `getAgentService()` — agent lifecycle (create, update status, get tree)
- `ItemService`, `getItemService()` — item CRUD (messages, tool calls, tool results, reasoning)
- `ItemRepository`, `getItemRepository()` — direct item queries (pagination, rewind)
- Types: `CreateSessionOptions`, `CreateItemData`, `CreateItemResult`, `Repository`

## Responsibility Boundary

Owns all session/agent/item persistence and query logic. Does not execute agents or resolve tools — that's `chat/`.

## Read Next

- [Chat](../chat/README.md)
- [Config](../config/README.md)
