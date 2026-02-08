# Lucy Backend Separation Migration Specification

**Version:** 2.0
**Date:** 2026-02-08
**Status:** Phases 1-5 COMPLETE, Phase 6 TODO

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Migration Phases](#migration-phases)
4. [What Was Built (Phases 1-4)](#what-was-built-phases-1-4)
5. [What's Next (Phases 5-6)](#whats-next-phases-5-6)
6. [Security & Authentication](#security--authentication)
7. [Testing & Validation](#testing--validation)
8. [Deployment Strategy](#deployment-strategy)
9. [Rollback Plan](#rollback-plan)
10. [Appendix](#appendix)

---

## Executive Summary

### Current State (after Phases 1-4)
Lucy now has **two connected stacks** in a monorepo:
1. **Desktop App** (`renderer/` + `main/`) - Electron + embedded Next.js, with API client connecting to cloud backend. **Updated in Phase 5.**
2. **Cloud Backend** (`backend/`) - Standalone Next.js API server with JWT auth, multi-user support, dual SQLite/PostgreSQL. **NEW.**

The desktop frontend connects to the cloud backend via an authenticated API client (`renderer/src/lib/api/client.ts`). All hooks have been rewired to call the backend instead of local API routes.

### Target State
Cloud deployment on Railway with PostgreSQL, enabling multi-device sync, centralized API key management, and a foundation for a future web version.

### Key Benefits
- Centralized API key management (security)
- Multi-device synchronization
- Easier backend updates without app distribution
- Foundation for future web version
- Improved scalability

---

## Architecture Overview

### Current State (Two Independent Stacks)

```
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│  Desktop App (unchanged)            │    │  Cloud Backend (NEW)                │
│  Electron + Next.js                 │    │  Standalone Next.js :3001           │
├─────────────────────────────────────┤    ├─────────────────────────────────────┤
│                                     │    │                                     │
│  React UI → /api/sessions/[id]/chat │    │  /api/auth/* → JWT tokens           │
│         ↓                           │    │  /api/sessions/* → requireAuth      │
│  ChatService → AI Provider → SSE    │    │  /api/settings/* → requireAuth      │
│         ↓                           │    │  /api/* (16 routes) → requireAuth   │
│  SQLite (local, no auth)            │    │         ↓                           │
│                                     │    │  SQLite (dev) / PostgreSQL (prod)   │
│  NOT connected to backend ──────────┼──✗─┤  userId on all tables              │
│                                     │    │                                     │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
```

### Target State (after Phases 5-6)

```
┌────────────────────────┐           ┌─────────────────────────────┐
│  Desktop Frontend      │           │   Backend Server            │
│  (Electron)            │           │   (Next.js on Railway)      │
├────────────────────────┤           ├─────────────────────────────┤
│                        │  HTTPS    │                             │
│  React UI              │  + JWT    │  /api/* endpoints           │
│  useSessionChat hook   │◄─────────▶│  requireAuth middleware     │
│                        │  Bearer   │                             │
│  Token in keytar       │  token    │  PostgreSQL (Railway)       │
│  (macOS Keychain)      │           │  userId scoping             │
└────────────────────────┘           └─────────────────────────────┘
```

---

## Migration Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **1** | Backend project infrastructure | DONE |
| **2** | Landing page & health check | DONE |
| **3** | Authentication system (JWT, register/login/verify) | DONE |
| **4** | Database schema (users table, userId, dual SQLite/Postgres) | DONE |
| **4b** | Services & API routes migration (all 16 routes + auth) | DONE |
| **5** | Frontend integration (rewire desktop app to backend) | DONE |
| **6** | Deployment (Railway + Postgres) | TODO |

---

## What Was Built (Phases 1-4)

### Backend File Structure

```
backend/
├── package.json              # Independent deps (next, ai-sdk, drizzle, bcrypt, jwt, pg)
├── tsconfig.json             # @/* → ./src/*, strict mode
├── next.config.js            # standalone output, better-sqlite3 external
├── drizzle.config.ts         # Dual SQLite/Postgres based on DATABASE_PROVIDER env
├── .env.example              # All env vars documented
├── .gitignore
├── tailwind.config.ts
├── postcss.config.mjs
└── src/
    ├── middleware.ts          # CORS for /api/* (configurable origins)
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx           # Landing page
    │   └── api/
    │       ├── auth/
    │       │   ├── login/route.ts      # POST: email+password → JWT
    │       │   ├── register/route.ts   # POST: create user → JWT
    │       │   └── verify/route.ts     # GET: validate JWT
    │       ├── health/route.ts         # GET: DB connectivity check
    │       ├── sessions/
    │       │   ├── route.ts            # GET/POST (userId scoped)
    │       │   └── [id]/
    │       │       ├── route.ts        # GET/PUT/DELETE
    │       │       ├── chat/route.ts   # POST SSE streaming
    │       │       └── plans/route.ts  # GET
    │       ├── providers/route.ts
    │       ├── settings/route.ts
    │       ├── system-prompts/
    │       │   ├── route.ts
    │       │   └── [id]/route.ts
    │       ├── quick-actions/
    │       │   ├── route.ts
    │       │   └── [id]/route.ts
    │       ├── mcp-servers/
    │       │   ├── route.ts
    │       │   ├── [id]/route.ts
    │       │   ├── [id]/test/route.ts
    │       │   └── status/route.ts
    │       ├── tools/route.ts
    │       └── openapi/route.ts
    └── lib/
        ├── auth/
        │   ├── jwt.ts          # signToken, verifyToken (jsonwebtoken)
        │   ├── middleware.ts    # requireAuth, optionalAuth
        │   ├── types.ts        # JWTPayload, AuthUser, AuthResult
        │   └── index.ts
        ├── rate-limit.ts       # In-memory rate limiter (Map-based)
        ├── db/
        │   ├── schema.ts       # Full schema + users table + userId FKs
        │   └── index.ts        # Dual SQLite/Postgres via DATABASE_PROVIDER
        ├── services/           # All services copied + userId parameter added
        │   ├── session/        # session.repository.ts, session.service.ts
        │   ├── agent/          # agent.repository.ts, agent.service.ts
        │   ├── item/           # item.repository.ts, item.service.ts, item.transformer.ts
        │   ├── chat/           # chat.service.ts, step-persistence.service.ts
        │   ├── plan/           # plan.repository.ts, plan.service.ts
        │   ├── config/         # settings, system-prompt, quick-action services
        │   ├── conversation-search/
        │   ├── filesystem/
        │   ├── repository.types.ts
        │   └── index.ts
        ├── ai/                 # providers.ts, models.ts, tokens.ts (copied)
        ├── tools/              # Full tool system (registry, modules, providers, utils)
        ├── integrations/       # MCP (with userId), conversations, filesystem, obsidian, plan
        ├── tracing/            # Langfuse integration
        ├── openapi/
        ├── utils.ts
        └── types/

Total: ~90 files
```

### Key Implementation Decisions

1. **Monorepo, not separate repo** - `backend/` lives alongside `renderer/` in the same git repo
2. **SQLite syntax for schema** - Single schema file works for both SQLite and Postgres (Drizzle handles dialect translation)
3. **`DATABASE_PROVIDER` env toggle** - `sqlite` (default for dev) or `postgres` (for Railway prod)
4. **userId as method parameter** - Services keep singleton pattern, but every method takes userId
5. **Items/planSteps without userId** - Accessed through parent entities (agent/plan) that have userId
6. **Port 3001** - Backend runs on 3001 to avoid conflict with desktop's 3000

### Auth Pattern (every protected route)

```typescript
const authResult = await requireAuth(request);
if ("error" in authResult) return authResult.error;
const { userId } = authResult.user;
// ... pass userId to service calls
```

### Dual DB Pattern

```typescript
const provider = process.env.DATABASE_PROVIDER || "sqlite";
export const db = provider === "postgres" ? createPostgresDb() : createSqliteDb();
```

### Tables with userId

| Table | userId? | Notes |
|-------|---------|-------|
| users | N/A | This IS the user table |
| sessions | YES | |
| agents | YES | |
| items | NO | Accessed via agent |
| systemPrompts | YES | |
| quickActions | YES | |
| plans | YES | |
| planSteps | NO | Accessed via plan |
| settings | YES | Per-user settings |
| mcpServers | YES | |
| sessionMcpServers | NO | Junction table |
| integrations | YES | |

---

## What's Next (Phases 5-6)

### Phase 5: Validation & Frontend Integration (COMPLETE)

**What was done:**
- Backend validated: compiles and runs, health endpoint and auth flow verified
- Created `renderer/src/lib/api/client.ts` - APIClient class with Bearer token auth, 401 handling, baseURL from `NEXT_PUBLIC_API_URL`
- Created `renderer/src/hooks/useAuth.tsx` - AuthProvider context + useAuth hook (login/register/logout/verify)
- Created `renderer/src/components/providers.tsx` - Client wrapper for root layout
- Created `renderer/src/components/auth-guard.tsx` - Redirects unauthenticated users to /login
- Created login page (`renderer/src/app/login/page.tsx`) and register page (`renderer/src/app/register/page.tsx`)
- Updated root layout to wrap with Providers (AuthProvider)
- Updated (main) layout to wrap with AuthGuard
- Rewired ALL hooks (`useSessions`, `useSettings`, `useSystemPrompts`, `useQuickActions`, `useMcpServers`, `useMcpStatus`, `usePlan`, `useAgentChat`) to use `api.request()` instead of `fetch("/api/...")`
- Updated ChatInput and QuickActions components similarly
- `useAgentChat`'s `DefaultChatTransport` now points to `${API_BASE_URL}/api/sessions/${sessionId}/chat` with auth headers
- Created `renderer/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`
- Backend CORS already allows `http://localhost:8888`

### Phase 6: Deployment

**Target: Railway** (Postgres + Node.js hosting)

```bash
cd backend
railway login
railway init
railway add        # Add Postgres plugin
railway up         # Deploy
```

**Environment variables to set on Railway:**
- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL` (auto-set by Railway Postgres plugin)
- `JWT_SECRET` (strong random string)
- `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`
- `CORS_ORIGINS=lucy://,https://app.lucy.ai`

**Postgres migrations:**
```bash
DATABASE_PROVIDER=postgres DATABASE_URL="postgresql://..." npx drizzle-kit push
```

---

## Security & Authentication

### Implemented (Phase 3-4)

- [x] JWT auth with 7-day expiry (jsonwebtoken)
- [x] bcrypt password hashing (10 rounds)
- [x] `requireAuth` / `optionalAuth` middleware on all routes
- [x] CORS middleware with configurable allowed origins
- [x] Rate limiting on auth endpoints (in-memory Map)
- [x] Zod validation on auth inputs
- [x] userId scoping on all data queries (multi-tenancy)
- [x] `.env.example` with all secrets documented
- [x] `.gitignore` excludes `.env`, `.env.local`, `*.db`

### TODO (Phase 5-6)

- [ ] HTTPS enforcement in production (Railway handles this)
- [ ] Secure token storage in Electron (keytar/keychain)
- [ ] Token refresh mechanism
- [ ] Password reset flow
- [ ] Email verification (optional)

---

## Testing & Validation

### Backend Smoke Tests

```bash
# 1. Health check
curl http://localhost:3001/api/health

# 2. Register
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"testtest","name":"Test"}'

# 3. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"testtest"}'

# 4. Verify token
curl http://localhost:3001/api/auth/verify \
  -H 'Authorization: Bearer <token>'

# 5. List sessions (empty)
curl http://localhost:3001/api/sessions \
  -H 'Authorization: Bearer <token>'

# 6. Create session
curl -X POST http://localhost:3001/api/sessions \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{}'

# 7. Landing page
open http://localhost:3001
```

### Future: Automated Tests

- Unit tests: JWT sign/verify, rate limiter
- Integration tests: Full auth flow, CRUD operations
- E2E tests: Desktop login → chat flow (Playwright)

---

## Rollback Plan

1. **Desktop app is untouched** - No changes to `renderer/` or `main/`. Desktop app works exactly as before.
2. **Backend is additive** - `backend/` is a new directory. Deleting it restores original state.
3. **Git tag before changes** - Tag current version: `git tag v0.9.0-pre-backend-separation`
4. **Dual-mode (future)** - Consider `USE_EMBEDDED_SERVER` env var to toggle between local and cloud modes.

---

## Appendix

### A. API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | DB connectivity check |
| `/api/auth/register` | POST | No | Create user → JWT |
| `/api/auth/login` | POST | No | Email+password → JWT |
| `/api/auth/verify` | GET | Yes | Validate JWT token |
| `/api/sessions` | GET | Yes | List user's sessions |
| `/api/sessions` | POST | Yes | Create session |
| `/api/sessions/:id` | GET | Yes | Get session |
| `/api/sessions/:id` | PUT | Yes | Update session |
| `/api/sessions/:id` | DELETE | Yes | Delete session |
| `/api/sessions/:id/chat` | POST | Yes | SSE chat stream |
| `/api/sessions/:id/plans` | GET | Yes | List plans for session |
| `/api/providers` | GET | Yes | List AI providers |
| `/api/settings` | GET/PUT | Yes | User settings |
| `/api/system-prompts` | GET/POST | Yes | System prompts CRUD |
| `/api/system-prompts/:id` | GET/PUT/DELETE | Yes | Single system prompt |
| `/api/quick-actions` | GET/POST | Yes | Quick actions CRUD |
| `/api/quick-actions/:id` | GET/PUT/DELETE | Yes | Single quick action |
| `/api/mcp-servers` | GET/POST | Yes | MCP servers CRUD |
| `/api/mcp-servers/:id` | GET/PUT/DELETE | Yes | Single MCP server |
| `/api/mcp-servers/:id/test` | POST | Yes | Test MCP server connection |
| `/api/mcp-servers/status` | GET | Yes | All MCP server statuses |
| `/api/tools` | GET | Yes | List available tools |
| `/api/openapi` | GET | Optional | OpenAPI spec |

### B. Environment Variables

**backend/.env.example:**
```bash
# Database
DATABASE_PROVIDER=sqlite     # sqlite | postgres
DATABASE_URL=                # Required when DATABASE_PROVIDER=postgres

# Authentication
JWT_SECRET=your-secret-key-change-in-production

# AI Providers
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
OPENAI_API_KEY=

# Observability (optional)
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASEURL=

# Server
PORT=3001
CORS_ORIGINS=http://localhost:3000,http://localhost:8888
```

### C. Key Differences: Desktop vs Backend

| Aspect | Desktop (`renderer/`) | Backend (`backend/`) |
|--------|----------------------|---------------------|
| Auth | None | JWT (Bearer token) |
| Multi-user | No (`userId` absent) | Yes (`userId` on all tables) |
| Database | SQLite only | SQLite OR Postgres |
| Runs as | Embedded in Electron | Standalone :3001 |
| Frontend | Full React UI | Landing page only |
| API keys | Client-side .env | Server-side .env |
| Schema | `renderer/src/lib/db/schema.ts` | `backend/src/lib/db/schema.ts` |

### D. Cost Estimates (Railway)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Railway Compute | $5 credit/mo | ~$5-15/mo |
| Railway Postgres | 1GB free | ~$5-10/mo |
| Custom domain | Free | Free |
| **Total** | **$0-5/mo** | **$10-25/mo** |
