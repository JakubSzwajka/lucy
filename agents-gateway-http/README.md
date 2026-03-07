# agents-gateway-http

Lightweight REST gateway that exposes the `agents-runtime` execution loop over HTTP using Hono.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create a session + root agent (optional `agentConfigId`, `modelId`, `systemPrompt`) |
| `GET` | `/sessions/:id` | Read session and agent status |
| `POST` | `/chat` | Send a message and get a synchronous response (`sessionId`, `message`, optional `modelId`) |
| `GET` | `/health` | Liveness check |

## Quick Start

```bash
npm install
npm run dev          # tsx watch, default port 3080
# or
PORT=4000 npm start  # custom port
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3080` | Server listen port |
| `AGENTS_DATA_DIR` | `~/.agents-data` | File-based storage root (shared with agents-runtime) |

## Responsibility Boundary

Owns HTTP routing, request validation, and response shaping. Delegates all agent execution and persistence to `agents-runtime` via `AgentRuntime` + `createFileAdapters`.

## Read Next

- [agents-runtime](../agents-runtime/README.md) - standalone runtime this gateway wraps
- [e2e test script](./scripts/e2e-test.sh) - curl-based integration tests
