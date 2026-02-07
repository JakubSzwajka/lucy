# API Surface Cleanup Spec

## Problem

The API has three groups of endpoints that blur the boundary between user-facing and internal concerns:

- `/api/sessions/*` - Session management (user-facing)
- `/api/agents/*`, `/api/agents/[id]/items` - Agent/item CRUD (internal, zero frontend callers)
- `/api/chat` - Legacy streaming endpoint (superseded by `/api/sessions/[id]/chat`)

The frontend should only interact with sessions. Agents and items are implementation details.

## Current State (Audit Results)

### Frontend-Facing (called by hooks/components)

| Endpoint | Hook/Component |
|----------|---------------|
| `GET/POST /api/sessions` | `useSessions` |
| `GET/PATCH/DELETE /api/sessions/[id]` | `useSessionChat`, `useSessions` |
| `POST /api/sessions/[id]/chat` | `useSessionChat` |
| `GET/PATCH /api/settings` | `useSettings` |
| `GET /api/providers` | `MainLayout` |
| `GET /api/plans` | `usePlan` |
| `GET /api/tools` | `ChatInput` |
| `GET/POST/PATCH/DELETE /api/system-prompts/*` | `useSystemPrompts` |
| `GET/POST/PATCH/DELETE /api/mcp-servers/*` | `useMcpServers`, `useMcpStatus` |

### Internal (zero frontend callers)

| Endpoint | Current Status |
|----------|---------------|
| `POST /api/agents` | Route exists, no callers |
| `GET/PATCH/DELETE /api/agents/[id]` | Route exists, no callers |
| `GET/POST /api/agents/[id]/items` | Route exists, no callers |
| `POST /api/chat` | Route exists, superseded by session chat |

All internal communication uses the service layer directly (in-process), not HTTP.

---

## Action Items

### 1. Delete `/api/chat` route

**Files to delete:**
- `renderer/src/app/api/chat/route.ts`

**Rationale:** Fully superseded by `/api/sessions/[id]/chat`. No frontend callers. No service-to-service HTTP calls. If sub-agents need direct chat in the future, they should use the service layer directly (in-process), not HTTP.

**Risk:** None. Zero callers confirmed by audit.

---

### 2. Delete `/api/agents` route (collection)

**Files to delete:**
- `renderer/src/app/api/agents/route.ts`

**Rationale:** Agent creation happens atomically inside `SessionRepository.create()`. Sub-agent creation (future) should go through `AgentService` directly, not HTTP. Zero frontend callers.

**Risk:** None. Zero callers confirmed.

---

### 3. Delete `/api/agents/[id]` route (individual)

**Files to delete:**
- `renderer/src/app/api/agents/[id]/route.ts`

**Rationale:** Agent data is accessed via `GET /api/sessions/[id]` which returns `SessionWithAgents` including the full agent tree with items. No need for a separate agent endpoint. Agent updates (status, turnCount) happen through `AgentService` in-process from `ChatService`.

**Risk:** None. Zero callers confirmed.

---

### 4. Delete `/api/agents/[id]/items` route

**Files to delete:**
- `renderer/src/app/api/agents/[id]/items/route.ts`

**Rationale:** User messages are now persisted server-side in `/api/sessions/[id]/chat`. Assistant messages/tool calls are persisted via `persistStepContent()` in the `onStepFinish` callback. Item reads come through the session endpoint. Zero frontend callers.

**Risk:** None. Zero callers confirmed.

---

### 5. Clean up OpenAPI spec

**Files to modify:**
- `renderer/src/lib/openapi/spec.ts`

**Changes:**
- Remove `/api/chat` endpoint definition
- Remove `/api/agents` endpoint definitions
- Remove `/api/agents/{id}` endpoint definitions
- Remove `/api/agents/{id}/items` endpoint definitions
- Add `/api/sessions/{id}/chat` endpoint definition
- Update `ChatRequest` schema to remove `agentId` field

---

### 6. Update all documentation

**Files to update:**
- `README.md` - Already updated with session-centric diagrams
- `renderer/src/app/api/README.md` - Remove deleted route references, update file structure
- `renderer/src/lib/services/README.md` - If it references agent routes
- `CLAUDE.md` - Update API Routes section (currently lists `/api/chat` and `/api/agents/[id]/items`)

---

## Execution Order

```
1. Delete /api/chat/route.ts                    (independent)
2. Delete /api/agents/route.ts                  (independent)
3. Delete /api/agents/[id]/route.ts             (independent)
4. Delete /api/agents/[id]/items/route.ts       (independent)
5. Clean up OpenAPI spec                        (after 1-4)
6. Update documentation                         (after 5)
7. Run lint + verify                            (after all)
```

Items 1-4 are independent and can run in parallel.

## What We Keep

- `/api/sessions/*` - The user-facing session API
- Service layer (`AgentService`, `ItemService`, `ChatService`) - Used in-process by routes and tools
- All configuration endpoints (`/api/settings`, `/api/system-prompts`, `/api/mcp-servers`, etc.)
