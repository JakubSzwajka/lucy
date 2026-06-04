---
prd: subagent-architecture
generated: 2026-03-20
last-updated: 2026-03-20
---

# Tasks: Subagent Architecture — Gateway as Deterministic Router

> Summary: Replace the singleton AgentRuntime with a subprocess-based subagent spawner. The gateway becomes the router, each conversation is a `pi` subprocess with its own session file, and anamnesis gains agent-aware context filtering.

## Task List

- [ ] **1. Create lucy agent definition** — migrate PROMPT.md into `.pi/agents/lucy.md`
- [ ] **2. Build subprocess spawner** — new `SubagentRunner` that spawns `pi --mode json -p` and streams events
- [ ] **3. Build session registry** — map `(channel, conversationId)` to session file paths
- [ ] **4. Rewrite AgentRuntime as SubagentRuntime** — replace singleton session with spawner + registry
- [ ] **5. Update gateway chat routes** — accept `agent` and `sessionId` params, use new runtime `[blocked by: 2, 3, 4]`
- [ ] **6. Update gateway session routes** — session info and new-session work with subprocess model `[blocked by: 4]`
- [ ] **7. Update Telegram handler** — route through SubagentRuntime with chat-ID-based sessions `[blocked by: 4]`
- [ ] **8. Agent-aware anamnesis context** — filter experience sections by `PI_AGENT_NAME` env var
- [ ] **9. Clean up old singleton** — remove `initRuntime()` singleton, update gateway bootstrap `[blocked by: 5, 6, 7]`
- [ ] **10. End-to-end verification** — test streaming, session continuity, telegram, anamnesis per-agent `[blocked by: 9]`

---

### 1. Create lucy agent definition
<!-- status: pending -->

Create `.pi/agents/lucy.md` with YAML frontmatter (name, description, model, thinking level, tools) and move the full `PROMPT.md` content into the markdown body. Keep `PROMPT.md` in place temporarily (task 9 removes it). The agent definition becomes the single source of truth for Lucy's default personality, model, and tool config.

**Files:** `.pi/agents/lucy.md` (new), `PROMPT.md` (read only)
**Depends on:** —
**Validates:** `pi --mode json -p --no-session .pi/agents/lucy.md "hello"` equivalent works — agent loads with correct prompt and tools.

---

### 2. Build subprocess spawner
<!-- status: pending -->

Create a `SubagentRunner` class (or module) in `src/runtime/core/src/` that:
- Spawns `pi --mode json -p --session {file} --model {model} --tools {tools} "{message}"` as a child process
- Passes `PI_AGENT_NAME` and `OPENROUTER_API_KEY` as env vars to the subprocess
- Reads stdout line-by-line, parses each JSON line into a `PiJsonEvent`
- Translates `PiJsonEvent` into existing `StreamEvent` types (`text_delta`, `thinking_delta`, `tool_start`, `tool_end`, `agent_start`, `agent_end`)
- Exposes a `subscribe()` callback mechanism matching the current `AgentRuntime` pattern
- Handles process errors, non-zero exit codes, and abort (kill subprocess)
- Returns the full assistant response text for non-streaming callers (Telegram)

Pi JSON event types to map: `message_update` with `assistantMessageEvent.type` of `text_delta` → `StreamEvent.text_delta`, `thinking_delta` → `StreamEvent.thinking_delta`. Tool events: `tool_execution_start` → `tool_start`, `tool_execution_end` → `tool_end`. Lifecycle: `agent_start` → `agent_start`, `agent_end` → `agent_end`.

**Files:** `src/runtime/core/src/runtime/subagent-runner.ts` (new), `src/runtime/core/src/types/pi-json-events.ts` (new)
**Depends on:** —
**Validates:** Unit-testable: spawn `pi --mode json -p --no-session --no-tools "hello"` and receive parsed `StreamEvent[]` back.

---

### 3. Build session registry
<!-- status: pending -->

Create a `SessionRegistry` class in `src/runtime/core/src/` that manages the mapping from `(channel: string, conversationId: string)` to a session file path. Responsibilities:
- `resolve(channel, conversationId)` → returns existing session path or creates a new one
- `create(channel, agentName)` → generates a new session file path (e.g. `.agents/pi/sessions/webui-{uuid}.jsonl`)
- `list()` → returns all tracked sessions with metadata (channel, agent, last-used timestamp)
- Persists the mapping to `.agents/pi/session-registry.json` on every mutation
- Loads from disk on construction (survives gateway restarts)

Keep it simple — a JSON file, not SQLite. The registry is small (tens of sessions, not thousands).

**Files:** `src/runtime/core/src/runtime/session-registry.ts` (new)
**Depends on:** —
**Validates:** Create registry, resolve same (channel, id) twice → same path. Different (channel, id) → different path. Restart → state preserved.

---

### 4. Rewrite AgentRuntime as SubagentRuntime
<!-- status: pending -->

Create `SubagentRuntime` that replaces `AgentRuntime` as the runtime interface. It composes `SubagentRunner` + `SessionRegistry` and exposes the same public API the gateway expects:
- `sendMessageStreaming(message, options: { agent?, channel?, conversationId? })` — resolves session, spawns subprocess, pipes events via subscribe
- `sendMessage(message, options)` — same but collects full response
- `subscribe(callback)` / `unsubscribe()` — event streaming
- `abort()` — kills active subprocess
- `getHistory(options)` — reads session file from disk and parses it (or delegates to `pi --export`)
- `getSessionInfo()` — returns session metadata from registry + session file stats
- `newSession(channel, conversationId)` — creates fresh session file in registry

The key change: runtime no longer holds a long-running `AgentSession`. Each `sendMessage` call is a subprocess lifecycle (spawn → stream → exit).

**Files:** `src/runtime/core/src/runtime/subagent-runtime.ts` (new), `src/runtime/core/src/index.ts` (update export)
**Depends on:** 2, 3
**Validates:** Can send a message via `SubagentRuntime`, receive streamed events, and send a follow-up that resumes the session.

---

### 5. Update gateway chat routes
<!-- status: pending -->

Modify `src/gateway/core/src/routes/chat.ts` to:
- Accept optional `agent` (string, default "lucy") and `sessionId` (string) in POST body
- If no `sessionId`, derive one from context (e.g. generate UUID for webui)
- Pass `{ agent, channel: "webui", conversationId: sessionId }` to `SubagentRuntime.sendMessageStreaming()`
- SSE streaming stays the same pattern — subscribe, pipe events, close on `agent_end`
- Non-streaming `/api/chat` passes same options to `sendMessage()`
- History endpoint reads from the session file path via registry

Also update `src/gateway/core/src/runtime.ts` to init `SubagentRuntime` instead of `AgentRuntime`.

**Files:** `src/gateway/core/src/routes/chat.ts`, `src/gateway/core/src/runtime.ts`
**Depends on:** 4
**Validates:** `POST /api/chat/stream { message: "hello" }` returns SSE events. `POST /api/chat/stream { message: "follow up", sessionId: "..." }` resumes conversation.

---

### 6. Update gateway session routes
<!-- status: pending -->

Modify `src/gateway/core/src/routes/session.ts`:
- `GET /api/session?sessionId={id}` — returns session info for a specific session (from registry + file stats)
- `POST /api/session/new` — accepts optional `{ agent }`, creates new session in registry, returns session info with sessionId
- `GET /api/sessions` (new) — lists all sessions from registry

The current `getSessionInfo()` reads live session stats (token counts, context usage). With subprocess model, these stats come from the `agent_end` event's usage data or from parsing the session file. Start simple: return registry metadata (sessionId, agent, channel, createdAt) without live token counts.

**Files:** `src/gateway/core/src/routes/session.ts`
**Depends on:** 4
**Validates:** `POST /api/session/new` returns a sessionId. `GET /api/session?sessionId=...` returns metadata.

---

### 7. Update Telegram handler
<!-- status: pending -->

Modify `src/gateway/extensions/telegram/src/handler.ts` to pass channel/session context:
- Use `channel: "telegram"` and `conversationId: String(chatId)` when calling runtime
- This automatically maps each Telegram chat to a persistent session file via the registry
- No other changes needed — `sendMessage()` returns the same `{ response }` shape

Also update `src/gateway/extensions/telegram/src/index.ts` — the plugin receives `SubagentRuntime` instead of `AgentRuntime` (same interface, different type import).

**Files:** `src/gateway/extensions/telegram/src/handler.ts`, `src/gateway/extensions/telegram/src/index.ts`
**Depends on:** 4
**Validates:** Send two messages from same Telegram chat → both use same session file. Different chat IDs → different sessions.

---

### 8. Agent-aware anamnesis context
<!-- status: pending -->

Modify `.pi/extensions/anamnesis/hooks/context.ts` `assembleContext()` to:
- Read `process.env.PI_AGENT_NAME` (default: "lucy")
- Define a section filter map: which agent loads which experience sections
- Wrap each section load (entity, knowledge, dispositions, relations, memories, tensions, predictions, questions, journal, arcs) in an `if (sections.includes("sectionName"))` guard
- Default agent ("lucy") loads all sections (preserves current behavior)

This is a small, backward-compatible change. If `PI_AGENT_NAME` is not set, everything works exactly as before.

**Files:** `.pi/extensions/anamnesis/hooks/context.ts`
**Depends on:** —
**Validates:** Set `PI_AGENT_NAME=architect` → only entity, knowledge, tensions, memories loaded. Unset → all sections loaded (current behavior).

---

### 9. Clean up old singleton
<!-- status: pending -->

Remove the old `AgentRuntime` class and singleton infrastructure:
- Delete `src/runtime/core/src/runtime/agent-runtime.ts`
- Update `src/runtime/core/src/index.ts` to export `SubagentRuntime` (and optionally re-export as `AgentRuntime` alias for backward compat)
- Update `src/gateway/core/src/runtime.ts` — `initRuntime()` creates `SubagentRuntime`
- Update `src/gateway/core/src/index.ts` — remove any references to old init pattern
- Remove `PROMPT.md` from project root (content now lives in `.pi/agents/lucy.md`)
- Verify `npm run typecheck` passes

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts` (delete), `src/runtime/core/src/index.ts`, `src/gateway/core/src/runtime.ts`, `src/gateway/core/src/index.ts`, `PROMPT.md` (delete)
**Depends on:** 5, 6, 7
**Validates:** `npm run typecheck` passes. No imports of `AgentRuntime` remain. `npm run dev` starts without errors.

---

### 10. End-to-end verification
<!-- status: pending -->

Verify the full migration works across all channels:
- **WebUI streaming**: Send message via `/api/chat/stream`, receive SSE `text_delta` events, send follow-up in same session
- **WebUI new session**: `POST /api/session/new`, then chat in the new session
- **Telegram**: Send message, verify response, send follow-up (same session file)
- **Anamnesis context**: Check `[anamnesis]` log output confirms context sections loaded
- **Anamnesis reflection**: Trigger compaction (long conversation or manual) — verify `.agents/experience/` files updated
- **Session persistence**: Restart gateway, send follow-up to existing session — conversation continues
- **Abort**: Start a long response, hit `/api/chat/abort`, verify subprocess killed cleanly

Document any latency observations (cold start time) in the notebook.

**Files:** (no code changes — manual and scripted testing)
**Depends on:** 9
**Validates:** All checks above pass. Gateway serves webui + telegram with session continuity and anamnesis context.
