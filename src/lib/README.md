# lib

Two sub-trees with an explicit boundary:

## `server/` — Backend modules (Node.js only)

- `chat/` - agent execution engine (orchestration, tools, step persistence)
- `sessions/` - conversation data model (session, agent, item CRUD)
- `config/` - agent configs, system prompts, settings
- `plans/` - plan and step CRUD
- `ai/` - model registry + provider clients
- `memory/` - structured continuity memory subsystem
- `mcp/` - Model Context Protocol client, pool, and management
- `triggers/` - webhook triggers and scheduling
- `auth/` - JWT and route auth guards
- `db/` - schema and DB singleton
- `openapi/` - spec builder
- `rate-limit.ts` - rate limiting utility

## `client/` — Browser-safe modules

- `api/` - API client singleton
- `query/` - React Query helpers
- `utils.ts` - `cn()` classname helper
- `utils/` - shared client utilities
- `tts.ts` - text-to-speech utility

## Layering Rule

Server modules never import from `client/`; client modules never import from `server/`.
Each directory README explains only that directory's contract.
