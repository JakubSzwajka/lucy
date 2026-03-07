---
prd: agents-gateway-http
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Agents Gateway HTTP

> Summary: Create a minimal standalone HTTP service that wraps `AgentRuntime` — accept HTTP requests, map them to runtime calls, return responses. Non-streaming, file-based, no auth.

## Task List

- [x] **1. Scaffold `agents-gateway-http` package** — create directory, package.json with agents-runtime dependency, tsconfig, entry point
- [x] **2. Set up monorepo workspaces** — configure root package.json so gateway can import agents-runtime as a workspace dependency
- [x] **3. Implement health endpoint** — `GET /health` returns `{ ok: true }` `[blocked by: 1, 2]`
- [x] **4. Implement session creation** — `POST /sessions` seeds config, agent, and session files via runtime adapters `[blocked by: 1, 2]`
- [x] **5. Implement session read** — `GET /sessions/:id` returns session metadata and agent status `[blocked by: 4]`
- [x] **6. Implement chat endpoint** — `POST /chat` persists user message, calls `runtime.run()`, returns response `[blocked by: 4]`
- [x] **7. Add error handling middleware** — catch errors, return structured JSON `[blocked by: 3]`
- [x] **8. Verify end-to-end with curl** — start server, create session, send message, get response `[blocked by: 6, 7]`

---

### 1. Scaffold `agents-gateway-http` package
<!-- status: done -->

Create `agents-gateway-http/` at repo root. `package.json` should declare `agents-runtime` as a workspace dependency and a minimal HTTP framework (Hono or Express — keep it light). Add `tsx` as a dev dependency for running without a build step. Entry point at `src/index.ts` that starts an HTTP server on a configurable port (default 3080). No `@/` path alias.

**Files:** `agents-gateway-http/package.json`, `agents-gateway-http/tsconfig.json`, `agents-gateway-http/src/index.ts`
**Depends on:** —
**Validates:** `cd agents-gateway-http && npm install && npx tsx src/index.ts` starts a server that listens on port 3080

---

### 2. Set up monorepo workspaces
<!-- status: done -->

Add `"workspaces"` field to root `package.json` listing both `agents-runtime` and `agents-gateway-http`. After this, `npm install` at root links the packages and the gateway can `import { AgentRuntime } from 'agents-runtime'`. If monorepo workspaces already exist from prior work, just add the gateway to the list.

**Files:** `package.json`
**Depends on:** 1
**Validates:** `npm install` at root succeeds; `import { AgentRuntime } from 'agents-runtime'` resolves in gateway code

---

### 3. Implement health endpoint
<!-- status: done -->

Add `GET /health` route that returns `{ ok: true }`. This is the simplest route — use it to verify the server framework is working.

**Files:** `agents-gateway-http/src/routes/health.ts`, `agents-gateway-http/src/server.ts`
**Depends on:** 1, 2
**Validates:** `curl http://localhost:3080/health` returns `{"ok":true}`

---

### 4. Implement session creation
<!-- status: done -->

Add `POST /sessions` route. Accepts `{ agentConfigId?, modelId?, systemPrompt? }` in the body. Generates IDs for session, agent, and (if needed) a default agent config. Seeds the file-based stores using `createFileAdapters()` by writing the appropriate JSON files — follow the seeding pattern from `agents-runtime/scripts/smoke-test.ts`. Returns `{ sessionId, agentId }`. If no `agentConfigId` is provided, create a minimal default config with the given `modelId` and `systemPrompt`.

**Files:** `agents-gateway-http/src/routes/sessions.ts`
**Depends on:** 1, 2
**Validates:** `curl -X POST localhost:3080/sessions -d '{"modelId":"..."}' -H 'Content-Type: application/json'` returns session + agent IDs; JSON files appear in `.agents-data/`

---

### 5. Implement session read
<!-- status: done -->

Add `GET /sessions/:id` route. Reads session metadata from file, reads agent status, returns combined info. Returns 404 if session doesn't exist.

**Files:** `agents-gateway-http/src/routes/sessions.ts`
**Depends on:** 4
**Validates:** After creating a session, `curl localhost:3080/sessions/<id>` returns session info with agent status

---

### 6. Implement chat endpoint
<!-- status: done -->

Add `POST /chat` route. Accepts `{ sessionId, message, modelId? }`. Resolves the session's agent ID from the session file. Persists the user message via `ItemStore.createMessage()`. Builds model messages from stored items using the runtime's `itemsToModelMessages()`. Calls `runtime.run()` in non-streaming mode. Returns `{ response, agentId, reachedMaxTurns }`. The `AgentRuntime` instance can be created per-request or shared (stateless — no issue either way since state lives in files).

**Files:** `agents-gateway-http/src/routes/chat.ts`
**Depends on:** 4
**Validates:** After creating a session, `curl -X POST localhost:3080/chat -d '{"sessionId":"...","message":"Hello"}' -H 'Content-Type: application/json'` returns an agent response

---

### 7. Add error handling middleware
<!-- status: done -->

Add a catch-all error handler that converts thrown errors to JSON responses: `{ error: message }` with appropriate status codes (400 for validation, 404 for not found, 500 for unexpected). Log errors to stderr.

**Files:** `agents-gateway-http/src/middleware/error-handler.ts`
**Depends on:** 3
**Validates:** Hitting a non-existent route returns `404 { error: "Not found" }`; sending malformed JSON returns 400

---

### 8. Verify end-to-end with curl
<!-- status: done -->

Write a short test script (`agents-gateway-http/scripts/e2e-test.sh` or similar) that: starts the server, creates a session, sends a message, checks the response, and shuts down. This proves the full HTTP → runtime → file storage → response pipeline works. Can use a mock model (set via env var) or a real API key.

**Files:** `agents-gateway-http/scripts/e2e-test.sh`
**Depends on:** 6, 7
**Validates:** Script exits 0; response from agent is non-empty
