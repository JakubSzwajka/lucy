# agents-gateway-http

Lightweight REST gateway that exposes the `agents-runtime` execution loop over HTTP using Hono.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create a session + root agent (optional `agentConfigId`, `modelId`, `systemPrompt`) |
| `GET` | `/sessions` | List all sessions with agent status |
| `GET` | `/sessions/:id` | Read session and agent status |
| `GET` | `/sessions/:id/items` | Read conversation history for a session |
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
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## Gateway Plugins

The gateway supports plugins that register additional routes on the Hono app. Configured in `lucy.config.json` under `agents-gateway-http.plugins`:

```json
{
  "agents-gateway-http": {
    "plugins": {
      "enabled": ["whatsapp"],
      "configById": { "whatsapp": { ... } }
    }
  }
}
```

Plugins receive the Hono app and `AgentRuntime` on init — see `GatewayPlugin` interface in `src/types/gateway-plugins.ts`.

## Responsibility Boundary

Owns HTTP routing, request validation, response shaping, and gateway plugin lifecycle. All session lifecycle and agent execution is delegated to `AgentRuntime` — route handlers are thin shells (~5 lines each).

## Read Next

- [agents-runtime](../agents-runtime/README.md) - standalone runtime this gateway wraps
- [agents-plugin-whatsapp](../agents-plugin-whatsapp/README.md) - WhatsApp gateway plugin
- [agents-webui](../agents-webui/README.md) - React chat UI that consumes this gateway
- [e2e test script](./scripts/e2e-test.sh) - curl-based integration tests
