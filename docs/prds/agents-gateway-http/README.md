---
status: draft
date: 2026-03-07
---

# Agents Gateway HTTP

## Problem

The `agents-runtime` package exists as a standalone conversation engine, but there's no way to interact with it over HTTP. To use it, you need to write TypeScript code that imports the package, seeds data files, and calls `runtime.run()` directly. We need a lightweight HTTP service that accepts requests and maps them to runtime calls, so any HTTP client can have a conversation with an agent.

## Proposed Solution

Create `agents-gateway-http/` as a sibling package — a minimal HTTP server that wraps `AgentRuntime`. It provides REST endpoints for starting conversations, sending messages, and reading responses. It uses the runtime's default file-based storage (no database). The entire stack is: HTTP request → gateway → `AgentRuntime.run()` → file-based adapters → response.

This is **not** the Next.js app rewire. This is a fresh, standalone, minimal HTTP service. Think of it as the simplest possible way to talk to the runtime over the network.

## Package Structure

```
agents-gateway-http/
├── package.json             # depends on agents-runtime
├── tsconfig.json
├── src/
│   ├── server.ts            # HTTP server setup + route registration
│   ├── routes/
│   │   ├── chat.ts          # POST /chat — send message, get response
│   │   ├── sessions.ts      # POST /sessions, GET /sessions/:id
│   │   └── health.ts        # GET /health
│   ├── middleware/
│   │   └── error-handler.ts # Catch errors, return JSON
│   └── index.ts             # Entry point — starts the server
└── .agents-data/            # default data directory (gitignored)
```

## Scope

### Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| `POST /sessions` | Create a new session + agent + seed config files. Returns `{ sessionId, agentId }` |
| `GET /sessions/:id` | Get session metadata and agent status |
| `POST /chat` | Send a message, get a response. Body: `{ sessionId, message, modelId? }`. Non-streaming for v1 |
| `GET /health` | Returns `{ ok: true }` |

### Request/Response Examples

**Create session:**
```
POST /sessions
{ "agentConfigId": "config-1" }

→ 201 { "sessionId": "...", "agentId": "..." }
```

**Send message:**
```
POST /chat
{ "sessionId": "...", "message": "Hello, who are you?" }

→ 200 { "response": "I'm your assistant...", "agentId": "...", "reachedMaxTurns": false }
```

### What this gateway does

- Accepts HTTP requests, validates input
- Creates sessions/agents by writing seed files via the runtime's file adapters
- Persists user messages via `ItemStore` before calling the runtime
- Calls `AgentRuntime.run()` in **non-streaming mode** and returns the result
- Basic error handling (400, 404, 500)

### What this gateway does NOT do

- SSE/streaming responses (future enhancement)
- Authentication or multi-user support
- Tool injection or plugin management
- Frontend serving
- Database persistence

## Tech Choice

Use raw Node.js `http` module or a minimal framework (Hono, Express). Keep dependencies minimal — the gateway should be as lightweight as the runtime. The runtime is the only significant dependency.

## Key Cases

- `curl` a message to the gateway and get a response from the agent
- Create a session, send multiple messages, maintain conversation history across requests
- Start the server with just `npx tsx src/index.ts` — no build step required for dev
- The gateway works with the runtime's default file-based storage — no config needed beyond `OPENROUTER_API_KEY`

## Out of Scope

- SSE streaming (follow-up enhancement)
- Wiring to the existing Next.js app
- Postgres adapters
- Auth / multi-tenancy
- Frontend / UI

## References

- [Agent Runtime PRD](../extract-agent-runtime-and-gateways/README.md)
- [Runtime public API](../../../agents-runtime/src/index.ts)
- [Runtime smoke test](../../../agents-runtime/scripts/smoke-test.ts) — shows seeding pattern
