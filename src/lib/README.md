# lib

Two sub-trees with an explicit boundary:

## `server/` — Backend modules (Node.js only)

- `services/` - orchestration layer used by API routes
- `ai/` - model registry + provider clients
- `tools/` - tool registry/providers/modules for agent tool calls
- `memory/` - structured continuity memory subsystem
- `integrations/` - external/internal integration clients
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
