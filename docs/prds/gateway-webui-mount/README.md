---
status: draft
date: 2026-03-08
author: "kuba"
gh-issue: ""
---

# Mount WebUI and Landing Page in Gateway with Route Prefixes

## Problem

The gateway (`agents-gateway-http`) exposes API routes at the root level (`/chat`, `/models`, `/health`) and conditionally serves a landing page. The chat WebUI (`agents-webui`) runs as a separate Vite dev server, requiring CORS and a hardcoded `VITE_API_URL`. This means two processes to run, cross-origin complexity, and no single-origin deployment story. We want one server, one port, one URL.

## Proposed Solution

Reorganize the gateway's route structure into three clear zones:

| Prefix | Serves | Source |
|--------|--------|--------|
| `/api/*` | REST API (chat, models, health) | Gateway routes |
| `/chat/*` | Chat WebUI (SPA) | `agents-webui/dist` |
| `/` | Landing page | `agents-landing-page/dist` |

The API moves behind `/api` so it doesn't collide with static assets. The WebUI is served as a static SPA at `/chat` with index.html fallback for client-side routing. The landing page stays at the root. All three share one origin — no CORS needed between UI and API.

The WebUI's API client switches to relative paths (`/api/chat` instead of `http://localhost:3080/chat`), making it origin-agnostic.

## Key Cases

- `GET /` — serves landing page `index.html`
- `GET /chat` — serves WebUI SPA `index.html`
- `GET /chat/assets/*` — serves WebUI static assets (JS, CSS)
- `POST /api/chat` — sends a message (existing logic, new prefix)
- `GET /api/chat/history` — retrieves conversation history (new prefix)
- `GET /api/models` — lists available models (new prefix)
- `GET /api/health` — health check (new prefix)
- `GET /chat/anything` — SPA fallback: serves WebUI `index.html` for client-side routes
- WebUI works both embedded (same-origin, relative URLs) and standalone (Vite dev server with proxy or env override)

## Out of Scope

- WebSocket or SSE streaming changes — response format stays the same
- Authentication or authorization for the WebUI
- Building the WebUI as a gateway plugin (overkill for static file serving)
- Changing the WebUI's internal component structure or features
- Multi-session or multi-user support in the WebUI

## Open Questions

- Should the WebUI base path (`/chat`) be configurable via `lucy.config.json`?
- Do we need a build step that copies `agents-webui/dist` into the gateway, or is a resolved path at runtime sufficient?

## References

- `agents-gateway-http/src/server.ts` — current route mounting and `serveStatic` setup
- `agents-webui/src/api/client.ts` — API client with `VITE_API_URL` base
- `agents-webui/vite.config.ts` — build config (needs `base: "/chat/"` for prefix)
- Hono `serveStatic` docs for `@hono/node-server`
