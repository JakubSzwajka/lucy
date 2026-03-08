# Lucy - Development Guidelines

> The `.legacy/` directory contains the original Next.js application kept as a reference for module patterns (services, db, auth, tools, memory). It is not actively developed.

## Architecture Overview

Lucy is a **multi-package workspace** for agent infrastructure. Active packages extract core agent capabilities (runtime loop, HTTP gateway) into standalone, framework-agnostic modules. The original Next.js app is preserved in `.legacy/` as a reference implementation.

```
lucy/
├── agents-runtime/          # Standalone agent execution loop
├── agents-gateway-http/     # REST gateway for agent runtime (Hono)
├── .legacy/                 # Reference Next.js app (archived)
│   ├── src/                 # Full Next.js app source
│   ├── package.json         # Next.js dependencies
│   └── ...config files
├── docs/                    # Shared documentation
├── package.json             # Workspace root
├── CLAUDE.md
└── README.md
```

## Commands

### Workspace root

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run typecheck --workspace=agents-runtime` | Typecheck runtime package |
| `npm run typecheck --workspace=agents-gateway-http` | Typecheck gateway package |

### Legacy app

```bash
cd .legacy && npm install && npm run dev   # Starts on port 3009
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3009 |
| `npm run build` | Build for production (standalone output) |
| `npm run lint` | Lint source code |
| `npm run db:push` | Push schema to PostgreSQL |
| `npm run db:studio` | Open Drizzle Studio |

## TypeScript

- Enable strict mode in `tsconfig.json`
- Define explicit types for API responses, props, and state
- Use `satisfies` operator for type-safe object literals
- Prefer interfaces for public APIs, types for unions/intersections
- Never use `any`; use `unknown` and narrow with type guards

## Security

- API keys stored in `.env` (never commit to git)
- JWT auth (Bearer token) on all routes except health/openapi (`.legacy/`)
- CORS middleware with configurable allowed origins
- bcrypt password hashing, rate limiting on auth endpoints

## Logging

- Prefix all logs with `[source]` indicating where they happen: `[gateway]`, `[runtime]`, `[memory]`, `[whatsapp]`, `[plugins]`, etc.
- Keep logs concise — one summary line per operation, not step-by-step
- For HTTP requests, log a single line on completion: method, path, status, duration
- No emoji prefixes — use bracket prefixes only

## Error Handling

- Log errors with contextual information (prefixed with `[source]`)
- Show user-friendly error messages; never expose stack traces

## Code Quality

- Keep modules small; extract logic into focused utilities
- Write self-documenting code; add comments only for non-obvious logic

---

## Legacy App Reference (`.legacy/`)

The sections below document the archived Next.js app for reference when extracting patterns.

### Source Code (`.legacy/src/`)

- `@/` path alias resolves to `src/`
- Organize by feature/domain, not by file type
- Default to Server Components; use `'use client'` only when necessary

### API Routes

All routes in `.legacy/src/app/api/` with JWT auth + userId scoping.

| Route | Description |
|-------|-------------|
| `/api/auth/*` | Register/login/verify |
| `/api/sessions` | Session CRUD |
| `/api/sessions/[id]` | Single session operations |
| `/api/sessions/[id]/items` | Items for a session |
| `/api/sessions/[id]/plans` | Plans for a session |
| `/api/sessions/[id]/rewind` | Rewind session state |
| `/api/chat` | AI chat streaming (SSE) |
| `/api/agent-configs` | Agent configuration CRUD |
| `/api/providers` | Available AI providers |
| `/api/models` | Available AI models |
| `/api/settings` | App settings (per-user) |
| `/api/system-prompts` | System prompt management |
| `/api/mcp-servers` | MCP server management |
| `/api/tools` | Tool listing |
| `/api/identity` | Identity document management |
| `/api/memories` | Memory CRUD and graph |
| `/api/memory-settings` | Memory settings |
| `/api/questions` | Question management |
| `/api/triggers` | Trigger management and webhooks |
| `/api/openapi` | OpenAPI spec |
| `/api/health` | DB connectivity check |

### Database

PostgreSQL via `DATABASE_URL` env, schema in `.legacy/src/lib/server/db/schema.ts`.

**Schema:** `users`, `sessions`, `agents`, `items` (message | tool_call | tool_result | reasoning), `system_prompts`, `settings`, `plans` / `plan_steps`, `mcp_servers`, `integrations`.

### Typography Rules

Two fonts, two layers:

1. **Inter (Sans Serif)** — The Human Layer: communication, structural UI, natural language.
   - Use: default `font-sans` (body default).

2. **JetBrains Mono (Monospace)** — The Machine Layer: data, code, system status, precision elements.
   - Use: `font-mono` class or `.mono`/`.label`/`.label-dark`/`.label-sm` from globals.css.

**Rule of thumb:** If you are *reading* it (like a story), it's Inter. If you are *parsing* it (like data), it's JetBrains Mono.
