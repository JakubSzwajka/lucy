---
prd: new-session
generated: 2026-03-16
last-updated: 2026-03-16
---

# Tasks: New Session

> Summary: Add the ability to start a fresh conversation session — runtime method, gateway endpoint, and UI button.

## Task List

- [x] **1. Add `newSession()` to AgentRuntime** — Create a fresh Pi SDK session in-place using `SessionManager.newSession()`
- [x] **2. Add `POST /api/session/new` route** — Gateway endpoint that calls `runtime.newSession()` and returns new `SessionInfo`
- [x] **3. Add `newSession()` API client function** — WebUI fetch wrapper for the new endpoint `[blocked by: 2]`
- [x] **4. Add "New Session" button to SessionBar** — UI trigger that calls the endpoint and resets chat state `[blocked by: 3]`
- [x] **5. Disable new session during streaming** — Prevent session reset while a message is in-flight `[blocked by: 4]`

---

### 1. Add `newSession()` to AgentRuntime
<!-- status: done -->

Add a `newSession()` method to `AgentRuntime` that calls `this.session.sessionManager.newSession()` (or equivalent Pi SDK API) to start a fresh session in-place. The old session is preserved on disk automatically by Pi SDK. After creating the new session, clear any internal state (subscribers shouldn't carry stale data). Return the new `SessionInfo` so callers get immediate confirmation.

**Files:** `src/runtime/core/src/runtime/agent-runtime.ts`
**Depends on:** —
**Validates:** Calling `newSession()` followed by `getSessionInfo()` returns a different session ID with zero messages and zero cost.

---

### 2. Add `POST /api/session/new` route
<!-- status: done -->

Add a new route to the session router that calls `runtime.newSession()` and returns the resulting `SessionInfo` as JSON. This route is already behind the existing auth middleware (Bearer token). Keep it in the same session routes file alongside `GET /api/session`.

**Files:** `src/gateway/core/src/routes/session.ts`
**Depends on:** 1
**Validates:** `curl -X POST /api/session/new` returns 200 with a fresh `SessionInfo` (new ID, 0 messages).

---

### 3. Add `newSession()` API client function
<!-- status: done -->

Add a `newSession()` function to the webui API client that POSTs to `/api/session/new` and returns the parsed `SessionInfo`. Follows the same pattern as `abortGeneration()` — simple POST, parse JSON response.

**Files:** `src/gateway/extensions/webui/src/api/client.ts`
**Depends on:** 2
**Validates:** Function exists, types compile, can be imported by components.

---

### 4. Add "New Session" button to SessionBar
<!-- status: done -->

Add a button to `SessionBar` that calls `newSession()` from the API client, then resets the chat. This requires coordination with `useAgentStream` — after the API call succeeds, clear the local `items` state and refresh `SessionInfo`. Expose a `reset` callback from `useAgentStream` (or pass it down as a prop/callback). The button should use a simple icon (e.g. `+` or a "new chat" icon) and sit alongside the existing session info display.

**Files:** `src/gateway/extensions/webui/src/components/SessionBar.tsx`, `src/gateway/extensions/webui/src/hooks/useAgentStream.ts`, `src/gateway/extensions/webui/src/App.tsx`
**Depends on:** 3
**Validates:** Clicking the button clears the chat, session bar shows new session ID with 0 messages and $0 cost.

---

### 5. Disable new session during streaming
<!-- status: done -->

Disable the "New Session" button while `streaming` is true. The `streaming` state already exists in `useAgentStream` — pass it through to `SessionBar` (it may already be available as a prop or can be derived from existing state). Simple conditional: `disabled={streaming}`.

**Files:** `src/gateway/extensions/webui/src/components/SessionBar.tsx`
**Depends on:** 4
**Validates:** Button is visually disabled and unclickable while a message is streaming. Enabled again after stream ends.
