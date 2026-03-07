---
prd: runtime-session-lifecycle
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Extract session lifecycle into agents-runtime

> Summary: Add create/read/list methods to runtime ports and adapters, then expose session lifecycle operations from `AgentRuntime`. Simplify gateway routes to thin HTTP shells.

## Task List

- [x] **1. Add `create` method to `AgentStore` port and `FileAgentStore`** — extend the port with agent creation
- [x] **2. Add write methods to `ConfigStore` port and `FileConfigStore`** — support creating agent configs and system prompts
- [x] **3. Add `create`, `get`, `list` methods to `SessionStore` port and `FileSessionStore`** — full session lifecycle in the port
- [x] **4. Add `createSession` to `AgentRuntime`** — orchestrate session + agent + config creation
- [x] **5. Add `getSession` and `listSessions` to `AgentRuntime`** — query operations
- [x] **6. Add `sendMessage` to `AgentRuntime`** — consolidate user message append + run
- [x] **7. Re-export new types from runtime index** — ensure new port method types are available to consumers
- [x] **8. Rewrite gateway session routes to use runtime methods** — thin HTTP shell `[blocked by: 4, 5]`
- [x] **9. Rewrite gateway chat route to use `sendMessage`** — thin HTTP shell `[blocked by: 6]`

---

### 1. Add `create` method to `AgentStore` port and `FileAgentStore`
<!-- status: done -->

Add a `create(agent: Agent): Promise<Agent>` method to the `AgentStore` interface. Implement it in `FileAgentStore` — write the agent JSON to `agents/{agentId}.json`, creating the directory if needed. The gateway currently does this inline with `writeFile` in the sessions route; this extracts that into the proper adapter.

**Files:** `agents-runtime/src/ports.ts`, `agents-runtime/src/adapters/file-agent-store.ts`
**Depends on:** —
**Validates:** `FileAgentStore.create()` writes a valid agent JSON file and `getById()` can read it back

---

### 2. Add write methods to `ConfigStore` port and `FileConfigStore`
<!-- status: done -->

Add `createAgentConfig(config: AgentConfigWithTools): Promise<AgentConfigWithTools>` and `createSystemPrompt(prompt: SystemPrompt): Promise<SystemPrompt>` to the `ConfigStore` interface. Implement in `FileConfigStore` — write to `config/agents/{id}.json` and `config/prompts/{id}.json` respectively. These mirror the inline `writeFile` calls in the gateway's `POST /sessions` handler.

**Files:** `agents-runtime/src/ports.ts`, `agents-runtime/src/adapters/file-config-store.ts`
**Depends on:** —
**Validates:** Created configs and prompts can be read back via existing `getAgentConfig()` and `getSystemPrompt()` methods

---

### 3. Add `create`, `get`, `list` methods to `SessionStore` port and `FileSessionStore`
<!-- status: done -->

Extend `SessionStore` with: `create(session: { id: string; agentId: string }): Promise<void>`, `get(sessionId: string): Promise<Session | null>`, and `list(): Promise<Session[]>`. Define a `Session` type in `types.ts` (`{ id: string; agentId: string; updatedAt: string }`). Implement in `FileSessionStore` — `create` writes `sessions/{id}/session.json`, `get` reads it, `list` scans the sessions directory. The gateway currently does all of this with raw `readdir`/`readFile`.

**Files:** `agents-runtime/src/types.ts`, `agents-runtime/src/ports.ts`, `agents-runtime/src/adapters/file-session-store.ts`
**Depends on:** —
**Validates:** `create` + `get` round-trips; `list` returns all created sessions sorted by `updatedAt` descending

---

### 4. Add `createSession` to `AgentRuntime`
<!-- status: done -->

Add a `createSession(options: { agentConfigId?: string; modelId?: string; systemPrompt?: string }): Promise<{ sessionId: string; agentId: string }>` method to `AgentRuntime`. This orchestrates: generate IDs, optionally create a default `AgentConfigWithTools` and `SystemPrompt` via `ConfigStore`, create an `Agent` via `AgentStore`, create a session via `SessionStore`. This is a direct extraction of the logic currently in the gateway's `POST /sessions` handler.

**Files:** `agents-runtime/src/runtime.ts`
**Depends on:** 1, 2, 3
**Validates:** Calling `createSession()` produces the same file structure as the current gateway handler

---

### 5. Add `getSession` and `listSessions` to `AgentRuntime`
<!-- status: done -->

Add `getSession(sessionId: string): Promise<{ session: Session; agent: Agent } | null>` and `listSessions(): Promise<Array<{ id: string; agentId: string; updatedAt: string; agent: { status: string; turnCount: number } }>>` to `AgentRuntime`. These compose `SessionStore.get/list` with `AgentStore.getById` to return the joined view the gateway currently assembles inline.

**Files:** `agents-runtime/src/runtime.ts`
**Depends on:** 1, 3
**Validates:** `getSession` returns session + agent data; `listSessions` returns sorted list with agent status

---

### 6. Add `sendMessage` to `AgentRuntime`
<!-- status: done -->

Add `sendMessage(sessionId: string, message: string, options?: { modelId?: string }): Promise<{ response: string; agentId: string; reachedMaxTurns: boolean }>` to `AgentRuntime`. This consolidates the current `POST /chat` pattern: resolve session to get `agentId`, append user message via `ItemStore.createMessage`, call `this.run()` in non-streaming mode, return the result. The gateway currently does this across ~20 lines; this makes it a single call.

**Files:** `agents-runtime/src/runtime.ts`
**Depends on:** 3
**Validates:** `sendMessage` appends a user item, runs the agent, and returns the assistant response

---

### 7. Re-export new types from runtime index
<!-- status: done -->

Add the new `Session` type to the re-exports in the runtime's `index.ts`. Ensure consumers can import `Session` and the updated port types (`AgentStore`, `ConfigStore`, `SessionStore`) with the new methods.

**Files:** `agents-runtime/src/index.ts`
**Depends on:** 3
**Validates:** `import type { Session } from "agents-runtime"` compiles without errors

---

### 8. Rewrite gateway session routes to use runtime methods
<!-- status: done -->

Replace the body of `POST /sessions`, `GET /sessions`, `GET /sessions/:id`, and `GET /sessions/:id/items` in the gateway with calls to `AgentRuntime.createSession()`, `listSessions()`, `getSession()`, and item retrieval. Each handler should be ~5 lines: parse request, call runtime, return JSON. Remove all direct `fs` imports (`mkdir`, `readdir`, `readFile`, `writeFile`) and path construction from this file.

**Files:** `agents-gateway-http/src/routes/sessions.ts`
**Depends on:** 4, 5
**Validates:** All four endpoints return identical responses as before; no `fs` imports remain in the file

---

### 9. Rewrite gateway chat route to use `sendMessage`
<!-- status: done -->

Replace the `POST /chat` handler body with a call to `AgentRuntime.sendMessage()`. The handler becomes: validate input, call `runtime.sendMessage(sessionId, message, { modelId })`, return the result as JSON. Remove the direct `readFile` for session lookup and manual `createMessage` + `run` calls.

**Files:** `agents-gateway-http/src/routes/chat.ts`
**Depends on:** 6
**Validates:** `POST /chat` returns identical response shape; no `fs` imports remain in the file
