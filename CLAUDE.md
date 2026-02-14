# Lucy - Development Guidelines

## Architecture Overview

Lucy is an **AI assistant** that runs as both a **desktop app** (Electron + Next.js) and a **cloud backend** (standalone Next.js API server). The two stacks share the same business logic. The desktop frontend connects to the cloud backend via an authenticated API client.

## Documentation Architecture (Lego Rule)

**Start here when exploring the codebase:**
- `docs/data-flows.md` — end-to-end request flows (chat, session creation, delegation, config resolution)
- `backend/src/lib/README.md` — backend module graph entry point
- `backend/src/app/api/README.md` — API route index
- `docs/DOCUMENTATION-TEMPLATE.md` — template for new module READMEs

The backend is documented as composable modules with local READMEs.

- Each backend module directory should have a short `README.md`.
- A module README documents only its own contract (purpose, public API, usage).
- Orchestration-layer docs should not explain child internals; they should link to child READMEs.
- Use this hierarchy as a navigation graph: API routes -> services -> capabilities/integrations -> storage.

```
lucy-nextjs/
├── desktop/                 # Desktop app (Electron + Next.js frontend)
│   ├── main/                # Electron main process
│   │   ├── background.ts    # App entry, window management, IPC
│   │   ├── preload.ts       # Context bridge for renderer
│   │   └── helpers/         # Electron utilities
│   ├── renderer/            # Next.js frontend (Electron-embedded)
│   │   ├── src/
│   │   │   ├── app/         # Pages (login, register, chat)
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── lib/         # Utilities, API client
│   │   │   └── types/       # TypeScript types
│   │   ├── public/
│   │   └── next.config.js
│   ├── scripts/             # Build & dev scripts
│   ├── resources/           # App icons
│   ├── package.json
│   ├── tsconfig.json
│   └── electron-builder.yml
├── backend/                 # Standalone cloud API server
│   ├── src/
│   │   ├── app/             # API routes (auth-protected, multi-user)
│   │   └── lib/             # Services, database, auth, AI providers
│   ├── next.config.js       # Standalone output
│   ├── drizzle.config.ts    # Postgres support
│   └── package.json         # Independent dependencies
├── package.json             # Minimal root (convenience scripts)
├── CLAUDE.md
└── README.md
```

### Two Stacks

| | Desktop (`desktop/renderer/`) | Cloud (`backend/`) |
|---|---|---|
| **Auth** | None (local single-user) | JWT on every route |
| **Multi-user** | No | Yes (`userId` on all tables) |
| **Database** | None (cloud-only) | SQLite (dev) or Postgres (prod) |
| **Runs as** | Embedded in Electron | Standalone Next.js server |
| **Frontend** | Full React UI (calls cloud backend API) | Landing page only |
| **Port** | Electron-managed | 3001 |

## Commands

### Root (convenience)
| Command | Description |
|---------|-------------|
| `npm run dev:desktop` | Start desktop app (Electron + Next.js hot reload) |
| `npm run dev:backend` | Start backend server on port 3001 |
| `npm run build:desktop` | Build production desktop app (creates DMG/installer) |
| `npm run build:backend` | Build backend for production |
| `npm run lint` | Lint both desktop and backend |

### Desktop App (`cd desktop/`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode (Electron + Next.js hot reload) |
| `npm run build` | Build production app (creates DMG/installer) |
| `npm run lint` | Lint renderer code |

### Cloud Backend (`cd backend/`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend server on port 3001 |
| `npm run build` | Build for production (standalone output) |
| `npm run db:push` | Push schema to SQLite or Postgres |
| `npm run db:studio` | Open Drizzle Studio |

## Development Workflow

### Desktop App - Before First Run
```bash
cd desktop
npm install
npm run dev
```

### Cloud Backend - Before First Run
```bash
cd backend
npm install
cp .env.example .env.local   # Fill in JWT_SECRET + API keys
npm run db:push              # Initialize database schema
npm run dev                  # Starts on port 3001
```

### Running Both Stacks (Development)
```bash
# Terminal 1: Start cloud backend
cd backend && npm run dev    # Starts on port 3001

# Terminal 2: Start desktop app
cd desktop && npm run dev    # Starts Electron + Next.js on port 8888
```
The frontend at :8888 makes API calls to the backend at :3001. Set `NEXT_PUBLIC_API_URL` in `desktop/renderer/.env.local` to change the backend URL.

## Project Structure Conventions

### Main Process (`desktop/main/`)
- Handles Electron lifecycle, window management, and system integration
- IPC handlers for communication with renderer
- Keep minimal; most logic should be in renderer

### Renderer (`desktop/renderer/src/`)
- Use `@/` path alias for imports (resolves to `desktop/renderer/src/`)
- Organize by feature/domain, not by file type
- Keep components close to where they're used

### Components
- Default to Server Components; use `'use client'` only when necessary
- Extract client interactivity into small leaf components
- Co-locate component, styles, and tests in the same directory
- Use named exports for components

### API Routes (backend only)
All API routes live in `backend/src/app/api/` with JWT auth + userId scoping.

| Route | Description |
|-------|-------------|
| `/api/sessions` | Session CRUD |
| `/api/sessions/[id]/chat` | AI chat streaming (SSE) |
| `/api/sessions/[id]/plans` | Plans for a session |
| `/api/providers` | Available AI providers |
| `/api/settings` | App settings (per-user) |
| `/api/system-prompts` | System prompt management |
| `/api/quick-actions` | Quick action management |
| `/api/mcp-servers` | MCP server management |
| `/api/tools` | Tool listing |
| `/api/openapi` | OpenAPI spec |
| `/api/auth/*` | Register/login/verify |
| `/api/health` | DB connectivity check |

### Database
- **Backend only**: SQLite (dev) or PostgreSQL (prod) via `DATABASE_PROVIDER` env, schema in `backend/src/lib/db/schema.ts`
- In dev: Database at `backend/lucy.db`
- In prod: PostgreSQL via `DATABASE_URL`

**Schema (shared structure, backend adds userId):**
- `users` - User accounts (backend only)
- `sessions` - User-facing conversation container (has rootAgentId, userId in backend)
- `agents` - Runtime instances with parent-child hierarchy (parentId, sourceCallId)
- `items` - Polymorphic entries per agent (message | tool_call | tool_result | reasoning)
- `system_prompts` - Reusable system prompts
- `settings` - App-wide settings (per-user in backend)
- `plans` / `plan_steps` - Multi-step plan tracking
- `mcp_servers` - MCP server configuration
- `quick_actions` - Quick action prompts
- `integrations` - Third-party integration config

## TypeScript

- Enable strict mode in `tsconfig.json`
- Define explicit types for API responses, props, and state
- Use `satisfies` operator for type-safe object literals
- Prefer interfaces for public APIs, types for unions/intersections
- Never use `any`; use `unknown` and narrow with type guards

Three tsconfig files:
- `desktop/tsconfig.json` - Main process (CommonJS, targets Electron Node)
- `desktop/renderer/tsconfig.json` - Next.js frontend app (ESM, React JSX)
- `backend/tsconfig.json` - Next.js backend app (ESM, `@/*` → `./src/*`)

The renderer has no local database or services — all data flows through the API client to the cloud backend.

## Error Handling

- Implement `error.tsx` at appropriate route segments
- Use `notFound()` for 404 scenarios
- Log errors with contextual information
- Show user-friendly error messages; never expose stack traces

## Security

- API keys stored in `.env` (never commit to git)
- `contextIsolation: true` in Electron (enforced)
- `nodeIntegration: false` in Electron (enforced)
- Use preload script for any Node.js APIs needed in renderer
- Backend: JWT auth (Bearer token) on all routes except health/openapi
- Backend: CORS middleware with configurable allowed origins
- Backend: bcrypt password hashing, rate limiting on auth endpoints

## State Management

- Prefer URL state (`useSearchParams`, `usePathname`) for shareable state
- Use React Context sparingly; prefer Server Components data flow
- Keep client state minimal and close to where it's used

## Code Quality

- Run `npm run lint` and fix all warnings before committing
- Keep components under 200 lines; extract logic into hooks or utilities
- Write self-documenting code; add comments only for non-obvious logic

## Build & Distribution

### Desktop App
Production build uses custom script (`desktop/scripts/build.js`) that:
1. Builds Next.js in standalone mode
2. Compiles main process TypeScript
3. Packages with electron-builder

Outputs in `desktop/dist/`:
- `Lucy-{version}-arm64.dmg` - macOS Apple Silicon
- `Lucy-{version}.dmg` - macOS Intel

### Cloud Backend
- `cd backend && npm run build` produces standalone Next.js output
- Deploy to Railway (or any Node.js host) with Postgres
- Set `DATABASE_PROVIDER=postgres` + `DATABASE_URL` + `JWT_SECRET` in env

## Backend Separation Progress

### Done (Phases 1-5)
- [x] Backend project infrastructure (package.json, tsconfig, next.config, drizzle, CORS middleware)
- [x] Database schema with `users` table + `userId` on all data tables
- [x] Dual database connection (SQLite / PostgreSQL via env toggle)
- [x] Auth system (JWT, register/login/verify routes, rate limiting)
- [x] All services copied + adapted with `userId` parameter
- [x] All 16 API routes migrated with `requireAuth` middleware
- [x] Health check endpoint
- [x] Landing page
- [x] **Validation**: Backend compiles and runs, health endpoint + auth flow verified
- [x] **Frontend auth integration**: Login/register pages, AuthProvider, API client, all hooks rewired to backend
- [x] **Desktop separation**: Desktop app moved to `desktop/` subdirectory

### TODO (Next Phases)
- [ ] **PostgreSQL schema**: Generate and test Drizzle migrations for Postgres dialect
- [ ] **Deployment**: Railway setup (Postgres, env vars, CI/CD)
- [ ] **Offline/online mode**: Decide if desktop app works offline (local SQLite) or always hits cloud backend
- [ ] **API key management**: Move API keys from client-side .env to backend (centralized)
- [ ] **Shared code extraction**: Consider shared package for types/interfaces used by both renderer and backend
