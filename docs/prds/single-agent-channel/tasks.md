---
prd: single-agent-channel
generated: 2026-03-08
last-updated: 2026-03-08
---

# Tasks: Single-Agent Chat Channel

> Summary: Collapse the multi-session model into a single fixed chat channel. Remove session CRUD, boot one agent at startup, simplify all consumers. Add sliding-window compaction so the single long-lived conversation doesn't grow unbounded. 10 tasks, mostly sequential with some parallelism in the consumer layers.

## Task List

- [x] **1. Remove `Session` type and `SessionStore` port** — clean domain types and port interfaces
- [x] **2. Remove `sessionId` from `Agent`, `RunOptions`, and plugin types** — strip session references from all runtime types
- [x] **3. Add single-agent bootstrap to `AgentRuntime`** — boot one agent on startup, expose `sendMessage(message)` without sessionId
- [x] **4. Delete `FileSessionStore` and update adapter exports** — remove session adapter and wiring
- [x] **5. Simplify file storage layout for single agent** — flatten from per-session/per-agent directories to single-agent files
- [x] **6. Add compaction service** — sliding window + LLM summarization of old messages
- [x] **7. Rewrite gateway routes for single-agent** — delete sessions routes, simplify chat, add history endpoint
- [x] **8. Remove WhatsApp session mapping** — delete `PhoneSessionStore`, simplify handler `[blocked by: 3]`
- [x] **9. Simplify WebUI for single chat** — remove session list/creation, go straight to chat `[blocked by: 7]`
- [x] **10. Add compaction config to `lucy.config.json`** — window size and model settings `[blocked by: 6]`

---

### 1. Remove `Session` type and `SessionStore` port
<!-- status: done -->

Delete the `Session` interface from `agents-runtime/src/types/domain.ts` (lines 32-36). Delete the `SessionStore` interface from `agents-runtime/src/ports.ts` (lines 67-72). Remove the `Session` and `SessionStore` re-exports from `agents-runtime/src/index.ts`.

**Files:** `agents-runtime/src/types/domain.ts`, `agents-runtime/src/ports.ts`, `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** `npm run typecheck --workspace=agents-runtime` passes after removing all downstream references (tasks 2-4)

---

### 2. Remove `sessionId` from `Agent`, `RunOptions`, and plugin types
<!-- status: done -->

Remove `sessionId: string` from the `Agent` interface in `agents-runtime/src/types/domain.ts` (line 5). Remove `sessionId` from `RunOptions` in `agents-runtime/src/types/runtime.ts` (line 45). Remove `sessions: SessionStore` from `RuntimeDeps` in `agents-runtime/src/types/runtime.ts` (line 64). Grep for `sessionId` across `agents-runtime/src/types/plugins.ts` and `agents-runtime/src/plugins/lifecycle.ts` and remove it from any plugin hook input types and their call sites.

**Files:** `agents-runtime/src/types/domain.ts`, `agents-runtime/src/types/runtime.ts`, `agents-runtime/src/types/plugins.ts`, `agents-runtime/src/plugins/lifecycle.ts`
**Depends on:** 1
**Validates:** No references to `sessionId` remain in `agents-runtime/src/types/` or `agents-runtime/src/plugins/`

---

### 3. Add single-agent bootstrap to `AgentRuntime`
<!-- status: done -->

Refactor `AgentRuntime` to initialize a single fixed agent on construction (or first call). Replace `createSession()`, `getSession()`, `listSessions()`, and `getSessionItems()` with a simpler API. `sendMessage(message: string, options?)` should no longer require `sessionId` — it uses the single bootstrapped agent directly. Store the agent ID internally. The `run()` method loses its `sessionId` option. Add a `getHistory()` method that returns the agent's items.

Key changes in `agents-runtime/src/runtime/agent-runtime.ts`:
- Delete `createSession()` (lines 93-154), `getSession()` (lines 156-164), `listSessions()` (lines 166-193), `getSessionItems()` (lines 195-199)
- Refactor `sendMessage()` (lines 201-224): remove `sessionId` param, use internal `this.agentId`
- Refactor `run()` (lines 240-293): remove `sessionId` from options, remove `sessions.touch()` call
- Update `agents-runtime/src/runtime/execution.ts`: remove `sessionId` param from `finalizeRun()`, `runStreamingAgent()`, `runNonStreamingAgent()`
- Add bootstrap logic: on first `sendMessage()`, ensure agent + config exist on disk (create if missing using config from `lucy.config.json`)

**Files:** `agents-runtime/src/runtime/agent-runtime.ts`, `agents-runtime/src/runtime/execution.ts`, `agents-runtime/src/runtime/context.ts`
**Depends on:** 1, 2
**Validates:** `runtime.sendMessage("hello")` works without prior session creation; agent state persists across restarts

---

### 4. Delete `FileSessionStore` and update adapter exports
<!-- status: done -->

Delete `agents-runtime/src/adapters/file-session-store.ts` entirely. Remove the `FileSessionStore` import and `sessions` property from `agents-runtime/src/adapters/index.ts` (the `createFileAdapters()` factory). Remove the `sessions` dependency injection from the `AgentRuntime` constructor.

**Files:** `agents-runtime/src/adapters/file-session-store.ts` (delete), `agents-runtime/src/adapters/index.ts`
**Depends on:** 1, 3
**Validates:** No imports of `FileSessionStore` or `SessionStore` remain anywhere in the codebase

---

### 5. Simplify file storage layout for single agent
<!-- status: done -->

Update `FileAgentStore` and `FileItemStore` to use fixed paths for the single agent instead of dynamic ID-based paths. The new layout:

```
.agents-data/
  agent.json              # single agent state (was agents/{id}.json)
  items.jsonl             # conversation history (was items/{id}.jsonl)
  config/
    agent-config.json     # agent config (was config/agents/{id}.json)
    system-prompt.json    # system prompt (was config/prompts/{id}.json)
```

Add a migration check: if old-style directories exist (`agents/`, `sessions/`, `items/`), log a warning or auto-migrate on first boot.

**Files:** `agents-runtime/src/adapters/file-agent-store.ts`, `agents-runtime/src/adapters/file-item-store.ts`, `agents-runtime/src/adapters/file-config-store.ts`
**Depends on:** 3, 4
**Validates:** Fresh boot creates flat layout; existing data (if any) is accessible after migration

---

### 6. Add compaction service
<!-- status: done -->

Create a `CompactionService` that implements sliding-window summarization. After each exchange, if total item count exceeds the configured window size (default 50), the oldest messages beyond the window are summarized via an LLM call. The summary is stored in `.agents-data/compaction.json` and prepended to the conversation context on each turn.

Implementation:
- New file `agents-runtime/src/runtime/compaction.ts` with `CompactionService` class
- Method `compactIfNeeded(agentId, items, windowSize)`: checks count, summarizes overflow, writes compaction file
- Method `getCompactedContext()`: reads existing compaction summary
- Wire into `AgentRuntime.sendMessage()` — call after each successful exchange
- Prepend compacted summary as a system-level context block when building messages for the LLM

**Files:** `agents-runtime/src/runtime/compaction.ts` (new), `agents-runtime/src/runtime/agent-runtime.ts`
**Depends on:** 3, 5
**Validates:** After 60 messages in a conversation, only the last 50 + a summary are sent to the LLM; summary contains key points from the evicted messages

---

### 7. Rewrite gateway routes for single-agent
<!-- status: done -->

Delete `agents-gateway-http/src/routes/sessions.ts` entirely. Remove its import and route registration from `agents-gateway-http/src/server.ts`. Refactor `agents-gateway-http/src/routes/chat.ts`: remove `sessionId` from request body validation, call `runtime.sendMessage(message, { modelId })`. Add a new `GET /chat/history` endpoint that calls `runtime.getHistory()` and returns the items list (with compacted context if available).

**Files:** `agents-gateway-http/src/routes/sessions.ts` (delete), `agents-gateway-http/src/routes/chat.ts`, `agents-gateway-http/src/server.ts`
**Depends on:** 3
**Validates:** `POST /chat` works with just `{ message }` body; `GET /chat/history` returns conversation items; no session-related routes remain

---

### 8. Remove WhatsApp session mapping
<!-- status: done -->

Delete `agents-plugin-whatsapp/src/session-store.ts` entirely. Update `agents-plugin-whatsapp/src/handler.ts`: remove the `sessionStore.getOrCreateSession()` call, call `runtime.sendMessage(text)` directly. Update `agents-plugin-whatsapp/src/index.ts`: remove `PhoneSessionStore` import, instantiation, and `load()` call. Remove `sessionStore` from the `HandlerDeps` type. Clean up any phone-sessions.json references.

**Files:** `agents-plugin-whatsapp/src/session-store.ts` (delete), `agents-plugin-whatsapp/src/handler.ts`, `agents-plugin-whatsapp/src/index.ts`
**Depends on:** 3
**Validates:** WhatsApp inbound message flows through to `runtime.sendMessage()` without any session lookup; `phone-sessions.json` no longer created

---

### 9. Simplify WebUI for single chat
<!-- status: done -->

Delete `agents-webui/src/components/SessionList.tsx`. Update `agents-webui/src/App.tsx` to render `ChatPanel` directly without session selection. Refactor `agents-webui/src/api/client.ts`: remove `listSessions()`, `createSession()`, `getSession()`, `getSessionItems()`. Update `sendMessage()` to not require `sessionId`. Add `getHistory()` calling `GET /chat/history`. Remove unused session types from `agents-webui/src/api/types.ts`. Update `ChatPanel` to load history via `getHistory()` on mount and send messages without a session ID.

**Files:** `agents-webui/src/components/SessionList.tsx` (delete), `agents-webui/src/App.tsx`, `agents-webui/src/api/client.ts`, `agents-webui/src/api/types.ts`, `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 7
**Validates:** WebUI loads directly into chat view; messages send and receive without session creation step

---

### 10. Add compaction config to `lucy.config.json`
<!-- status: done -->

Add a `compaction` section to the `agents-runtime` config schema in `agents-runtime/src/config/load-config.ts`. Fields: `windowSize` (number, default 50), `summarizationModel` (string, optional — defaults to agent's model). Update `lucy.config.example.json` with documented defaults. Wire the config into `CompactionService` initialization in the runtime bootstrap.

**Files:** `agents-runtime/src/config/load-config.ts`, `lucy.config.example.json`
**Depends on:** 6
**Validates:** Setting `compaction.windowSize: 20` in config results in compaction triggering after 20 messages
