# Lucy - Development Guidelines

> The `.legacy/` directory contains the original Next.js application kept as a reference for module patterns (services, db, auth, tools, memory). It is not actively developed.

## Architecture Overview

Lucy is a **single-package** agent infrastructure project. All source code lives in `src/`, with two module buckets — `runtime/` and `gateway/` — each with a `core/` and `extensions/` directory. All code runs via `tsx` (no pre-compilation). The original Next.js app is preserved in `.legacy/` as a reference.

### Module dependency graph

```
┌─────────────────────────────────────────────────────────┐
│  RUNTIME                                                │
│                                                         │
│  ┌──────────────┐      ┌───────────────────────────┐    │
│  │  core        │ ◄─── │  extensions/memory        │    │
│  │  (agent loop)│      │  (observe/extract/synth)  │    │
│  └──────┬───────┘      └───────────────────────────┘    │
│         │                                               │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  GATEWAY                                                │
│                                                         │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │  core        │ ◄─── │  extensions/                 │ │
│  │  (Hono HTTP) │      │    webui     (React chat UI) │ │
│  │              │      │    landing   (Astro static)  │ │
│  │              │      │    whatsapp  (Meta webhook)  │ │
│  └──────────────┘      └──────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Cross-module imports use tsconfig `paths` (e.g. `"agents-runtime"` maps to `src/runtime/core/src/index.ts`). No npm workspaces — one flat dependency tree. Extensions are direct imports in `src/gateway/core/src/index.ts` — no plugin loader or manifest system.

### Directory structure

```
lucy/
├── src/
│   ├── runtime/
│   │   ├── core/                # Agent execution loop
│   │   └── extensions/
│   │       └── memory/          # Memory observer
│   └── gateway/
│       ├── core/                # REST gateway — Hono
│       └── extensions/
│           ├── webui/           # Chat UI — Vite + React
│           ├── landing-page/    # Static site — Astro
│           ├── whatsapp/        # WhatsApp integration
│           └── telegram/        # Telegram bot integration
├── .legacy/                     # Reference Next.js app (archived)
├── docs/                        # Shared documentation
├── package.json                 # Single package root
├── tsconfig.json                # Root config with path aliases
├── CLAUDE.md
└── README.md
```

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start gateway with tsx watch |
| `npm start` | Start gateway |
| `npm run typecheck` | Typecheck all modules (excl. webui/landing client code) |
| `npm run build` | Build static assets (webui + landing page) |
| `npm run build:webui` | Build webui only |
| `npm run build:landing` | Build landing page only |

### Legacy app

```bash
cd .legacy && npm install && npm run dev   # Starts on port 3009
```

## Configuration (`lucy.config.json`)

```json
{
  "runtime": { "model": "...", "compaction": {...}, "session": {...}, "extensions": [...] },
  "gateway": { "apiKey": "..." },
  "whatsapp": { "phoneNumberId": "...", "verifyToken": "...", "allowedNumbers": [...] },
  "telegram": { "allowedChatIds": [...] }
}
```

All keys are optional. The API key can also be set via `LUCY_API_KEY` env var. WhatsApp/Telegram sections are only needed if you want those integrations.

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
