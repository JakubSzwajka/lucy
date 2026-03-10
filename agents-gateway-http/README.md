# agents-gateway-http

REST gateway exposing `agents-runtime` over HTTP using Hono. Owns gateway plugin loading, lifecycle, and HTTP infrastructure.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | API key | Send a message, get response |
| `GET` | `/api/chat/history` | API key | Conversation history |
| `GET` | `/api/health` | None | Liveness check |

## Gateway Plugins

Plugins mount routes and middleware on the Hono app. Configured in `lucy.config.json`:

```jsonc
{
  "plugins": [
    { "package": "agents-webui", "config": {} },
    { "package": "agents-plugin-whatsapp", "config": { "phoneNumberId": "..." } }
  ]
}
```

Plugin authors import types from `agents-gateway-http/plugin`:

```ts
import type { GatewayPlugin, GatewayPluginManifest } from "agents-gateway-http/plugin";
```

Exported types: `GatewayPlugin`, `GatewayPluginManifest`, `GatewayPluginInitInput`, `GatewayPluginConfig`, `ResolvedGatewayPlugin`.

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3080` | Server listen port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `LUCY_API_KEY` | — | API key (or set in `lucy.config.json` auth) |

## Responsibility Boundary

Owns HTTP routing, auth middleware, CORS, gateway plugin loading and lifecycle. Delegates all agent execution to `AgentRuntime`. Route handlers are thin wrappers over runtime methods.

## Read Next

- [agents-runtime](../agents-runtime/README.md) — standalone runtime this gateway wraps
- [agents-webui](../agents-webui/README.md) — React chat UI (gateway plugin)
- [agents-plugin-whatsapp](../agents-plugin-whatsapp/README.md) — WhatsApp webhook (gateway plugin)
