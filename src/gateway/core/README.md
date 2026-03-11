---
title: Gateway (HTTP)
section: Gateway
order: 1
---

# agents-gateway-http

REST gateway exposing `agents-runtime` over HTTP using Hono. Loads extensions (webui, landing page, WhatsApp, Telegram) based on environment variables.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | API key | Send a message, get response |
| `GET` | `/api/chat/history` | API key | Conversation history |
| `GET` | `/api/health` | None | Liveness check |

## Configuration

All configuration is via environment variables (see `.env.example`).

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3080` | Server listen port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `LUCY_API_KEY` | — | API key for Bearer token auth on `/api/*` |

Extensions are enabled by setting their env vars (e.g. `WHATSAPP_PHONE_NUMBER_ID` enables WhatsApp, `TELEGRAM_BOT_TOKEN` enables Telegram).

## Responsibility Boundary

Owns HTTP routing, auth middleware, CORS, and extension initialization. Delegates all agent execution to `AgentRuntime`. Route handlers are thin wrappers over runtime methods.

## Read Next

- [agents-runtime](../../runtime/core/README.md) — RPC client this gateway wraps
- [webui](../extensions/webui/README.md) — React chat UI extension
- [whatsapp](../extensions/whatsapp/README.md) — WhatsApp webhook extension
- [telegram](../extensions/telegram/README.md) — Telegram bot extension
- [landing-page](../extensions/landing-page/README.md) — Static site extension
