# API Layer

HTTP adapters over service/capability modules.

## Auth Model

- Public routes: `/api/health`, `/api/openapi`, `/api/auth/login`, `/api/auth/register`
- Authenticated routes: everything else (via `requireAuth`)

## Route Groups

- `auth/` - login/register/token verify
- `sessions/` - session CRUD, chat turn execution, session plan
- `settings/`, `system-prompts/`, `quick-actions/` - user configuration
- `providers/` - available model providers based on API keys
- `tools/` - discovered tool inventory
- `mcp-servers/` - MCP server config and health
- `memories/`, `questions/`, `identity/`, `memory-settings/` - continuity subsystem
- `openapi/` - API schema endpoint

## Route Contract

Each route should:
1. authenticate user (if required)
2. parse request
3. call a service/capability API
4. return JSON/SSE response

## Read Next

- `../../lib/services/README.md`
- `../../lib/memory/README.md`
- `../../lib/tools/README.md`
