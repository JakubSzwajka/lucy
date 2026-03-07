---
status: draft
date: 2026-03-07
author: "kuba"
gh-issue: ""
---

# Agents WebUI — Minimal Chat Interface for agents-gateway-http

## Problem

The `agents-gateway-http` package exposes a REST API for the agent runtime, but there's no way to interact with it visually. Testing conversations requires curl commands or API clients. We need a simple browser-based UI to create sessions, send messages, and view conversation history — nothing fancy, just functional.

## Proposed Solution

A new workspace package `agents-webui` — a lightweight React + Vite application using shadcn/ui components. It talks directly to the gateway HTTP API. The UI has two views: a session list sidebar and a chat panel. Users can create sessions, select existing ones, and have conversations.

This is **not** a recreation of the legacy app. No auth, no agent config management, no tool management, no memory/identity features. Just chat.

### Gateway Prerequisites

The gateway currently lacks endpoints and configuration the WebUI needs. These must be added **before or alongside** the WebUI:

| Gap | Required Change (in `agents-gateway-http`) |
|-----|---------------------------------------------|
| No session listing | Add `GET /sessions` — return all sessions with agent status |
| No conversation history | Add `GET /sessions/:id/items` — return items for the session's root agent |
| No CORS | Add Hono CORS middleware allowing the WebUI origin |

## Key Cases

- **Create a new session** — click "New Chat", optionally set model ID, start chatting
- **List existing sessions** — sidebar shows all sessions sorted by last activity
- **Load conversation history** — selecting a session fetches and displays all items
- **Send a message** — type in input, submit, show loading state while waiting for response, display assistant reply
- **Display different item types** — user/assistant messages (markdown), tool calls as collapsible blocks
- **Error feedback** — show inline errors when API calls fail

## Out of Scope

- Authentication / multi-user support
- Agent configuration management (model, system prompt, tools)
- Streaming / SSE responses
- File uploads or image support
- Memory, identity, or trigger management
- Mobile-optimized layout
- Deployment / Docker configuration
- Replicating any legacy app feature beyond basic chat

## Resolved Questions

- **Pagination on `GET /sessions`?** — No. Load all sessions for v1.
- **CORS approach?** — CORS middleware on the gateway. Production-ready with configurable `CORS_ORIGIN`.
- **WebUI dev server port?** — No preference; use Vite default (5173).

## Dependencies on Other Packages

### agents-gateway-http (required changes)

1. **`GET /sessions`** — List all sessions. Response shape: `{ sessions: Array<{ id, agentId, updatedAt, agent: { status, turnCount } }> }`. Read all session directories from `.agents-data/sessions/`.

2. **`GET /sessions/:id/items`** — Get conversation items for the session's root agent. Response shape: `{ items: Item[] }`. Look up session -> agentId -> read from ItemStore.

3. **CORS middleware** — Add Hono CORS middleware with configurable `CORS_ORIGIN` env var (default `*` for dev).

## Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | React 19 + Vite | Fast dev, simple setup, workspace-compatible |
| Components | shadcn/ui (+ Tailwind v4) | Consistent aesthetics, copy-paste components |
| Markdown | `react-markdown` + `remark-gfm` | Render assistant responses |
| HTTP client | native `fetch` | No extra deps for simple REST |
| State | React state + context | No external state lib needed |

## References

- `agents-gateway-http/` — REST gateway source
- `agents-runtime/` — Runtime types and adapters
- `.legacy/` — Reference UI patterns (not to replicate)
