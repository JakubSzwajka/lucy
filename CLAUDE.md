# Lucy - Development Guidelines

## Architecture Overview

Lucy is an **AI assistant** running as a **Next.js web application** with JWT auth, multi-user support, and PostgreSQL storage.

## Documentation Architecture (Lego Rule)

**Start here when exploring the codebase:**
- `docs/data-flows.md` — end-to-end request flows (chat, session creation, delegation, config resolution)
- `src/lib/README.md` — backend module graph entry point
- `src/app/api/README.md` — API route index
- `docs/DOCUMENTATION-TEMPLATE.md` — template for new module READMEs

Each module directory should have a short `README.md` documenting only its own contract (purpose, public API, usage). Use the hierarchy as a navigation graph: API routes -> services -> capabilities/integrations -> storage.

```
lucy-nextjs/
├── src/
│   ├── app/                 # Pages + API routes (auth-protected, multi-user)
│   │   ├── (main)/          # Authenticated app pages
│   │   ├── api/             # REST API
│   │   ├── login/           # Login page
│   │   └── register/        # Register page
│   ├── components/          # React components
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Services, database, auth, AI providers
│   └── types/               # TypeScript types
├── public/                  # Static assets
├── docs/                    # Documentation
├── next.config.js
├── drizzle.config.ts
├── tsconfig.json
├── package.json
├── CLAUDE.md
└── README.md
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3001 |
| `npm run build` | Build for production (standalone output) |
| `npm run lint` | Lint source code |
| `npm run db:push` | Push schema to PostgreSQL |
| `npm run db:studio` | Open Drizzle Studio |

## Development Workflow

### Before First Run
```bash
npm install
cp .env.example .env.local   # Fill in JWT_SECRET + API keys
npm run db:push              # Initialize database schema
npm run dev                  # Starts on port 3001
```

## Project Structure Conventions

### Source Code (`src/`)
- Use `@/` path alias for imports (resolves to `src/`)
- Organize by feature/domain, not by file type
- Keep components close to where they're used

### Components
- Default to Server Components; use `'use client'` only when necessary
- Extract client interactivity into small leaf components
- Co-locate component, styles, and tests in the same directory
- Use named exports for components

### API Routes
All API routes live in `src/app/api/` with JWT auth + userId scoping.

| Route | Description |
|-------|-------------|
| `/api/sessions` | Session CRUD |
| `/api/sessions/[id]/chat` | AI chat streaming (SSE) |
| `/api/sessions/[id]/plans` | Plans for a session |
| `/api/providers` | Available AI providers |
| `/api/settings` | App settings (per-user) |
| `/api/system-prompts` | System prompt management |
| `/api/mcp-servers` | MCP server management |
| `/api/tools` | Tool listing |
| `/api/openapi` | OpenAPI spec |
| `/api/auth/*` | Register/login/verify |
| `/api/health` | DB connectivity check |

### Database
- PostgreSQL via `DATABASE_URL` env, schema in `src/lib/db/schema.ts`

**Schema:**
- `users` - User accounts
- `sessions` - User-facing conversation container (has rootAgentId, userId)
- `agents` - Runtime instances with parent-child hierarchy (parentId, sourceCallId)
- `items` - Polymorphic entries per agent (message | tool_call | tool_result | reasoning)
- `system_prompts` - Reusable system prompts
- `settings` - App-wide settings (per-user)
- `plans` / `plan_steps` - Multi-step plan tracking
- `mcp_servers` - MCP server configuration
- `integrations` - Third-party integration config

## TypeScript

- Enable strict mode in `tsconfig.json`
- Define explicit types for API responses, props, and state
- Use `satisfies` operator for type-safe object literals
- Prefer interfaces for public APIs, types for unions/intersections
- Never use `any`; use `unknown` and narrow with type guards

Single `tsconfig.json` at root with `@/*` → `./src/*` path alias.

## Error Handling

- Implement `error.tsx` at appropriate route segments
- Use `notFound()` for 404 scenarios
- Log errors with contextual information
- Show user-friendly error messages; never expose stack traces

## Security

- API keys stored in `.env` (never commit to git)
- JWT auth (Bearer token) on all routes except health/openapi
- CORS middleware with configurable allowed origins
- bcrypt password hashing, rate limiting on auth endpoints

## State Management

- Prefer URL state (`useSearchParams`, `usePathname`) for shareable state
- Use React Context sparingly; prefer Server Components data flow
- Keep client state minimal and close to where it's used

## Typography Rules

Two fonts, two layers:

1. **Inter (Sans Serif)** — The Human Layer: communication, structural UI, natural language.
   - Chat message bubbles, sidebar navigation, button labels, headers.
   - Use: default `font-sans` (no class needed, it's the body default).

2. **JetBrains Mono (Monospace)** — The Machine Layer: data, code, system status, precision elements.
   - Code blocks, timestamps, metadata labels (WAITING, MEMORY, CTX: 8.9K), keyboard shortcuts.
   - Use: `font-mono` class or `.mono`/`.label`/`.label-dark`/`.label-sm` utility classes from globals.css.

**Rule of thumb:** If you are *reading* it (like a story), it's Inter. If you are *parsing* it (like data), it's JetBrains Mono.

## Code Quality

- Run `npm run lint` and fix all warnings before committing
- Keep components under 200 lines; extract logic into hooks or utilities
- Write self-documenting code; add comments only for non-obvious logic

## Build & Deployment

- `npm run build` produces standalone Next.js output
- Deploy to Railway (or any Node.js host) with Postgres
- Set `DATABASE_URL` + `JWT_SECRET` in env
