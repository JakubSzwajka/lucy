---
prd: pi-sdk-migration
generated: 2026-03-16
last-updated: 2026-03-16
---

# Tasks: Migrate Pi from RPC bridge to SDK embedding

> Summary: Replace the subprocess + Unix socket bridge with direct `createAgentSession()` SDK calls. The `AgentRuntime` public API stays identical; only internals change. ~800 lines deleted, ~200 added.

## Task List

- [x] **1. Pin Pi SDK version and verify imports** — lock `@mariozechner/pi-coding-agent` to a specific version, verify `createAgentSession` and related exports are available
- [x] **2. Rewrite AgentRuntime.init() with createAgentSession** — replace socket connection with in-process session creation `[blocked by: 1]`
- [x] **3. Rewrite sendMessageStreaming with session.prompt + subscribe** — map Pi SDK events to existing StreamEvent types `[blocked by: 2]`
- [x] **4. Rewrite sendMessage (non-streaming)** — same session.prompt but buffer text deltas into response object `[blocked by: 2]`
- [x] **5. Rewrite getHistory using session.messages** — map Pi's message format to HistoryEntry[] `[blocked by: 2]`
- [x] **6. Rewrite getSessionInfo and getModels** — read from session state and model registry directly `[blocked by: 2]`
- [x] **7. Rewrite abort** — use session's abort/cancel mechanism `[blocked by: 2]`
- [x] **8. Update gateway runtime.ts initialization** — replace socket-based init with SDK session creation `[blocked by: 2]`
- [x] **9. Delete pi-bridge and socket-client** — remove subprocess spawning, Unix socket server, and RPC client `[blocked by: 3, 4, 5, 6, 7, 8]`
- [x] **10. Update environment variables and documentation** — remove bridge-specific env vars, add SDK-specific ones, update CLAUDE.md `[blocked by: 9]`
- [x] **11. Smoke test end-to-end** — verify chat/stream, chat, history, session, abort, and telegram all work `[blocked by: 9]`

---

### 1. Pin Pi SDK version and verify imports
<!-- status: done -->

Lock `@mariozechner/pi-coding-agent` to a specific version instead of `*`. Run `npm ls @mariozechner/pi-coding-agent` to find the currently installed version, pin it in `package.json`. Then create a small test file that imports `createAgentSession`, `DefaultResourceLoader`, `SessionManager`, `getModel` to verify the SDK surface is accessible from the project's TypeScript config.

**Files:** `package.json`, `tsconfig.json`
**Depends on:** —
**Validates:** `npm run typecheck` passes with explicit Pi SDK imports

---

### 2. Rewrite AgentRuntime.init() with createAgentSession
<!-- status: done -->

Replace the `SocketClient` connection with `createAgentSession()`. Create a `DefaultResourceLoader` configured with `cwd` and `agentDir` from env vars. Use `SessionManager.continueRecent()` for session persistence (falls back to new session). Map `PI_BRIDGE_MODEL` to `getModel()` call. Store the `session` object as a private field replacing `client`. Keep the same `init()` → `destroy()` lifecycle but `destroy()` now calls `session.dispose()` or equivalent cleanup.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 1
**Validates:** `AgentRuntime.init()` succeeds and logs session ID without pi-bridge running

---

### 3. Rewrite sendMessageStreaming with session.prompt + subscribe
<!-- status: done -->

Replace the socket RPC pattern with `session.subscribe()` + `session.prompt()`. Map Pi SDK events to existing `StreamEvent` discriminated union: `message_update` with `text_delta` → `TextDeltaEvent`, `thinking_delta` → `ThinkingDeltaEvent`, `tool_execution_start` → `ToolStartEvent`, `tool_execution_end` → `ToolEndEvent`, `agent_start`/`agent_end` → corresponding events. The subscribe callback receives Pi events directly — no JSON parsing needed.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** `POST /api/chat/stream` returns SSE events with correct types

---

### 4. Rewrite sendMessage (non-streaming)
<!-- status: done -->

Same approach as task 3 but buffer text deltas into a single response string. Subscribe before prompting, accumulate `text_delta` events, resolve on `agent_end`. Check `stopReason` on the last message for `reachedMaxTurns`. This method is used by Telegram — must return `{ response, agentId, reachedMaxTurns }`.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** `POST /api/chat` returns JSON response with text content

---

### 5. Rewrite getHistory using session.messages
<!-- status: done -->

Replace the `get_messages` RPC call with reading `session.messages` directly. The mapping logic (user/assistant/toolCall/toolResult/thinking → `HistoryEntry[]`) stays largely the same but reads from Pi's in-memory message array instead of an RPC response. Remove the `ensureConnected()` guard — session is always in-process.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** `GET /api/chat/history` returns correctly shaped HistoryEntry array

---

### 6. Rewrite getSessionInfo and getModels
<!-- status: done -->

For `getSessionInfo`: read `session.model`, `session.sessionId`, `session.messages` directly. Token/cost stats may be available through session state or subscription events — investigate what Pi SDK exposes. For `getModels`: use `ModelRegistry` to list available models instead of the `get_available_models` RPC.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** `GET /api/session` returns SessionInfo with model, tokens, and compaction data

---

### 7. Rewrite abort
<!-- status: done -->

Replace the `abort` RPC command with the SDK's session abort mechanism. Check if `AgentSession` exposes a cancel/abort method directly. If not, investigate `session.steer()` or `AbortController` pattern from the SDK docs.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** `POST /api/chat/abort` stops an in-flight generation

---

### 8. Update gateway runtime.ts initialization
<!-- status: done -->

Update `initRuntime()` in the gateway to no longer depend on a running pi-bridge process. The `AgentRuntime.init()` now creates the session in-process, so no socket connection wait is needed. Remove the pi-bridge spawn from the dev/start scripts if it's launched separately. Verify `destroyRuntime()` properly cleans up the Pi session.

**Files:** `src/gateway/core/src/runtime.ts`, `package.json` (scripts)
**Depends on:** 2
**Validates:** `npm run dev` starts successfully without pi-bridge subprocess

---

### 9. Delete pi-bridge and socket-client
<!-- status: done -->

Remove `src/runtime/core/src/pi-bridge/index.ts` (175 lines) and `src/runtime/core/src/runtime/socket-client.ts` (231 lines). Remove the `RpcEvent`, `RpcResponse`, `RpcCommand` type imports from `agent-runtime.ts`. Clean up any remaining references. Remove the pi-bridge related npm script if one exists.

**Files:** `src/runtime/core/src/pi-bridge/index.ts`, `src/runtime/core/src/runtime/socket-client.ts`, `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** 3, 4, 5, 6, 7, 8
**Validates:** `npm run typecheck` passes, no imports reference deleted files

---

### 10. Update environment variables and documentation
<!-- status: done -->

Remove `PI_BRIDGE_SOCKET`, `PI_BRIDGE_NO_SESSION` from `.env.example` and docs — they're bridge-specific. Keep `PI_BRIDGE_MODEL` (rename consideration: `PI_MODEL`?), `PI_BRIDGE_PROVIDER`, `PI_BRIDGE_PROMPT`. Update `CLAUDE.md` environment table. Update the architecture diagram in `CLAUDE.md` if it references the bridge. Add note about `.pi/extensions/` as the agent's evolvable surface.

**Files:** `CLAUDE.md`, `.env.example`, `docs/` (if relevant)
**Depends on:** 9
**Validates:** Documentation matches actual env vars and architecture

---

### 11. Smoke test end-to-end
<!-- status: done -->

Start the gateway with `npm run dev`. Test each endpoint: `POST /api/chat/stream` (SSE streaming), `POST /api/chat` (non-streaming), `GET /api/chat/history`, `GET /api/session`, `POST /api/chat/abort`. Verify Telegram integration still works if configured. Verify session persists across gateway restart using `SessionManager.continueRecent()`.

**Files:** —
**Depends on:** 9
**Validates:** All API endpoints return expected responses, session survives restart
