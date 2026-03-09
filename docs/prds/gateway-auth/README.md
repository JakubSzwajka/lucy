---
status: draft
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Gateway API Key Authentication

## Problem

The HTTP gateway exposes all API routes (`/api/chat`, `/api/chat/history`, `/api/models`) with zero authentication. Anyone who knows the gateway URL can interact with the agent, read chat history, and consume API credits. This is a security gap for any deployment beyond localhost.

Additionally, the WebUI and landing page are hardcoded in the gateway's `server.ts` rather than being registered plugins in `lucy.config.json`. This makes them invisible to the config system and impossible to enable/disable or configure.

## Proposed Solution

Add API key authentication at the gateway level as Hono middleware. A pre-shared API key is configured in `lucy.config.json` under `agents-gateway-http.auth`. All `/api/*` routes require a valid `Authorization: Bearer <key>` header. Health endpoint and landing page remain public.

The WebUI gets a login screen where the user enters the API key. The key is stored in localStorage and sent as a Bearer token on all API requests. No sessions, no password hashing, no user management — just a shared secret gating API access. HTTPS (provided by the hosting platform) protects the key in transit.

WebUI and landing page become proper gateway plugins registered in `lucy.config.json`, making them configurable and consistent with the plugin architecture.

## Key Cases

- **API request with valid key**: Request proceeds normally
- **API request with missing/invalid key**: 401 Unauthorized response
- **Auth disabled (no key configured)**: All requests pass through (backwards-compatible, local dev)
- **WebUI login flow**: User enters API key → stored in localStorage → attached to all requests
- **WebUI with invalid/expired key**: Shows login screen, clears stored key
- **WhatsApp plugin routes**: Excluded from gateway auth (has own webhook verification)
- **Health endpoint**: Always public (`/api/health` or `/health`)
- **Landing page**: Always public (static content, no API access)
- **WebUI as plugin**: Registered in `lucy.config.json`, serves static files at `/chat`
- **Landing page as plugin**: Registered in `lucy.config.json`, serves static files at `/`

## Out of Scope

- Multi-user authentication or user management
- Password hashing / bcrypt (this is an API key, not a password)
- OAuth / SSO / third-party auth providers
- Rate limiting (separate concern)
- Per-route granular permissions
- API key rotation mechanism (can be added later)

## Open Questions

- Should the API key be configurable via env var as well as config file? (env var is safer for CI/CD and avoids committing secrets)
- Should we support multiple API keys (e.g., one for WebUI, one for external integrations)?
- What's the right path layout — keep `/health` public at root, or only `/api/health`?

## References

- `agents-gateway-http/src/server.ts` — current route setup (hardcoded WebUI/landing page)
- `agents-gateway-http/src/routes/chat.ts` — API routes that need auth
- `agents-runtime/src/types/plugins.ts` — plugin type definitions
- `agents-plugin-whatsapp/src/routes/webhook.ts` — example of plugin-level auth
- `agents-webui/src/api/client.ts` — WebUI API client (needs Bearer header)
