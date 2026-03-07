---
prd: agents-webui
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Agents WebUI

> Summary: Add missing gateway endpoints (list sessions, get items, CORS), then build a minimal React + Vite chat UI as a new workspace package.

## Task List

- [x] **1. Add CORS middleware to gateway** — configure Hono CORS with `CORS_ORIGIN` env var
- [x] **2. Add GET /sessions endpoint** — list all sessions with agent status
- [x] **3. Add GET /sessions/:id/items endpoint** — return conversation items for a session
- [x] **4. Scaffold agents-webui package** — Vite + React + TypeScript + Tailwind v4 + shadcn/ui
- [x] **5. API client module** — typed fetch wrapper for all gateway endpoints
- [x] **6. App layout with session sidebar** — two-panel layout: sidebar + chat area `[blocked by: 4, 5]`
- [x] **7. Session list in sidebar** — fetch and display sessions, create new session `[blocked by: 6]`
- [x] **8. Chat message list** — render conversation items with markdown and tool call blocks `[blocked by: 6]`
- [x] **9. Chat input and send** — message input, submit, loading state, error display `[blocked by: 8]`
- [x] **10. Wire up session selection** — selecting a session loads its items into the chat panel `[blocked by: 7, 8]`

---

### 1. Add CORS middleware to gateway
<!-- status: done -->

Add CORS middleware to `agents-gateway-http` using Hono's built-in `cors()` helper. Read `CORS_ORIGIN` from environment (default `*` for dev convenience). Apply it globally before routes in `server.ts`. No new dependencies needed — Hono ships CORS built-in.

**Files:** `agents-gateway-http/src/server.ts`, `agents-gateway-http/src/config.ts`
**Depends on:** —
**Validates:** `curl -i -X OPTIONS http://localhost:3080/sessions` returns `Access-Control-Allow-Origin` header

---

### 2. Add GET /sessions endpoint
<!-- status: done -->

Add a `GET /sessions` route that reads all session directories from `.agents-data/sessions/`, loads each `session.json` + corresponding agent JSON, and returns them sorted by `updatedAt` descending. Response shape: `{ sessions: [{ id, agentId, updatedAt, agent: { status, turnCount } }] }`. Use `readdir` to list session directories. Add the route to the existing `sessions.ts` route file.

**Files:** `agents-gateway-http/src/routes/sessions.ts`
**Depends on:** —
**Validates:** `curl http://localhost:3080/sessions` returns JSON array of sessions after creating a few via `POST /sessions`

---

### 3. Add GET /sessions/:id/items endpoint
<!-- status: done -->

Add a `GET /sessions/:id/items` route that looks up the session's `agentId`, then uses `createFileAdapters(DATA_DIR).items.getByAgentId(agentId)` to fetch all items. Return them as `{ items: Item[] }` sorted by sequence. This reuses the runtime's `ItemStore` adapter rather than reading JSONL manually.

**Files:** `agents-gateway-http/src/routes/sessions.ts`
**Depends on:** —
**Validates:** Create a session, send a chat message, then `curl http://localhost:3080/sessions/{id}/items` returns user + assistant items

---

### 4. Scaffold agents-webui package
<!-- status: done -->

Create the `agents-webui/` directory as a new workspace package. Initialize with Vite + React + TypeScript template. Set up Tailwind v4 and shadcn/ui. Add the package to the root `package.json` workspaces array. Configure `vite.config.ts` with the gateway API URL via env var `VITE_API_URL` (default `http://localhost:3080`). Add `dev` and `build` scripts.

**Files:** `agents-webui/package.json`, `agents-webui/vite.config.ts`, `agents-webui/tsconfig.json`, `agents-webui/index.html`, `agents-webui/src/main.tsx`, `agents-webui/src/App.tsx`, `package.json` (root workspaces)
**Depends on:** —
**Validates:** `npm run dev --workspace=agents-webui` starts Vite dev server, renders a blank page

---

### 5. API client module
<!-- status: done -->

Create a typed API client module that wraps `fetch` calls to the gateway. Export functions: `listSessions()`, `createSession(opts?)`, `getSession(id)`, `getSessionItems(id)`, `sendMessage(sessionId, message, modelId?)`. Define TypeScript types for all request/response shapes matching the gateway API. Read base URL from `import.meta.env.VITE_API_URL`.

**Files:** `agents-webui/src/api/client.ts`, `agents-webui/src/api/types.ts`
**Depends on:** —
**Validates:** Types compile, functions are importable

---

### 6. App layout with session sidebar
<!-- status: done -->

Build the root layout component: a fixed-width sidebar on the left (session list area) and a flex-grow chat panel on the right. Use shadcn/ui `ScrollArea` for the sidebar. Add top-level state for `selectedSessionId`. Use Inter font for the UI (consistent with project typography rules).

**Files:** `agents-webui/src/App.tsx`, `agents-webui/src/components/Layout.tsx`, `agents-webui/src/index.css`
**Depends on:** 4, 5
**Validates:** Layout renders two-panel view with a visible sidebar and main area

---

### 7. Session list in sidebar
<!-- status: done -->

Build `SessionList` component that calls `listSessions()` on mount and displays sessions sorted by most recent. Each entry shows a truncated ID or timestamp. Add a "New Chat" button at the top that calls `createSession()` and selects the new session. Highlight the currently selected session. Use shadcn/ui `Button` and `ScrollArea`.

**Files:** `agents-webui/src/components/SessionList.tsx`
**Depends on:** 6
**Validates:** Sessions appear in sidebar after creating them, clicking one updates selection

---

### 8. Chat message list
<!-- status: done -->

Build `MessageList` component that receives an array of items and renders them. User messages styled as right-aligned bubbles. Assistant messages rendered with `react-markdown` + `remark-gfm` on the left. Tool call items rendered as collapsible blocks (shadcn/ui `Collapsible`) showing tool name, args, and result. Use JetBrains Mono for tool call content (machine layer typography). Auto-scroll to bottom on new messages.

**Files:** `agents-webui/src/components/MessageList.tsx`, `agents-webui/src/components/MessageBubble.tsx`, `agents-webui/src/components/ToolCallBlock.tsx`
**Depends on:** 6
**Validates:** Renders a hardcoded list of mixed item types correctly

---

### 9. Chat input and send
<!-- status: done -->

Build `ChatInput` component with a text input and send button. On submit, call `sendMessage()` API, optimistically append the user message to the list, show a loading indicator while waiting, then append the assistant response. Display inline error banner if the API call fails. Disable input while a message is in flight. Support Enter to send, Shift+Enter for newline. Use shadcn/ui `Button`, `Textarea`.

**Files:** `agents-webui/src/components/ChatInput.tsx`, `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 8
**Validates:** Can type a message, send it, see loading state, and see the response appear

---

### 10. Wire up session selection
<!-- status: done -->

Connect session selection to the chat panel. When a session is selected in the sidebar, call `getSessionItems(id)` and populate the `MessageList`. When a new session is created, clear the chat and set focus to the input. After sending a message, refresh the session list to update timestamps. Store selected session ID and items in app-level state (React context or lifted state in `App.tsx`).

**Files:** `agents-webui/src/App.tsx`, `agents-webui/src/components/ChatPanel.tsx`
**Depends on:** 7, 8
**Validates:** Full flow works: create session -> send message -> switch sessions -> history loads -> send another message
