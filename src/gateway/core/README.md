---
title: Gateway (HTTP)
section: Gateway
subsection: Core
order: 1
---

# agents-gateway-http

REST gateway exposing `agents-runtime` over HTTP using Hono. Loads extensions (webui, landing page, Telegram) based on environment variables.

## Activation

Start the gateway process with `npm run dev:gateway` or `npm run dev`. On boot it initializes `AgentRuntime`, mounts web UI and landing-page plugins, and mounts Telegram only when `TELEGRAM_BOT_TOKEN` is set.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | API key | Send a message, get response |
| `POST` | `/api/chat/stream` | API key | Send a message, stream SSE events |
| `GET` | `/api/chat/history` | API key | Conversation history |
| `GET` | `/api/session` | API key | Session info (model, tokens, cost) |
| `GET` | `/api/tasks` | API key | Task board |
| `GET` | `/api/health` | None | Liveness check |

## Configuration

All configuration is via environment variables (see `.env.example`).

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3080` | Server listen port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `LUCY_API_KEY` | — | API key for Bearer token auth on `/api/*` |
| `TELEGRAM_BOT_TOKEN` | — | Enables Telegram webhook routes |
| `TELEGRAM_CHAT_ID` | — | Optional single Telegram chat ID to allow |

Web UI and landing page mount whenever their `dist/` folders exist. Telegram mounts only when its token is present.

## Responsibility Boundary

Owns HTTP routing, auth middleware, CORS, and extension initialization. Delegates all agent execution to `AgentRuntime`. Route handlers are thin wrappers over runtime methods.

## Operational Constraints

- Requires the runtime bridge to be reachable during boot
- Protects `/api/chat*`, `/api/session`, and `/api/tasks` with API-key auth
- Static extensions silently skip registration when their build output is missing

## Read Next

- [agents-runtime](../../runtime/core/README.md) — RPC client this gateway wraps
- [webui](../extensions/webui/README.md) — React chat UI extension
- [telegram](../extensions/telegram/README.md) — Telegram bot extension
- [landing-page](../extensions/landing-page/README.md) — Static site extension
