# lib

Two sub-trees with an explicit boundary:

## `server/` — Backend modules (Node.js only)

- `chat/` - chat orchestration (streaming turns, agent execution)
- `domain/` - entity CRUD (session, agent, item, plan, agent-config, config)
- `ai/` - model registry + provider clients
- `tools/` - tool registry/providers/modules for agent tool calls
- `memory/` - structured continuity memory subsystem
- `mcp/` - Model Context Protocol client, pool, and management
- `triggers/` - webhook triggers and scheduling
- `search/` - conversation search and retrieval
- `filesystem/` - sandboxed filesystem operations
- `auth/` - JWT and route auth guards
- `db/` - schema and DB singleton
- `openapi/` - spec builder
- `rate-limit.ts` - rate limiting utility
- `tts.ts` - text-to-speech utility

## `client/` — Browser-safe modules

- `api/` - API client singleton
- `query/` - React Query helpers
- `utils.ts` - `cn()` classname helper
- `utils/` - shared client utilities

## Layering Rule

Server modules never import from `client/`; client modules never import from `server/`.
Each directory README explains only that directory's contract.
