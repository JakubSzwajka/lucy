---
title: Web UI
section: Gateway
subsection: Extensions
order: 10
---

# agents-webui

React chat UI for the `agents-gateway-http` REST API. Built with Vite, Tailwind CSS, and shadcn/ui components.

## Activation

The gateway mounts this UI at `/chat` when `src/gateway/extensions/webui/dist/` exists. Build it with `npm run build:webui`.

## Local Build

```bash
npm run build:webui
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3080` | Gateway base URL |

## Structure

```
src/
  api/          # API client and response types
  components/   # Layout, SessionList, ChatPanel, MessageList, ChatInput
  App.tsx       # Root component (session list + chat panel)
```

## Responsibility Boundary

Owns the browser UI for session management and chat interaction. All data and execution is delegated to `agents-gateway-http` via REST calls.

## Operational Constraints

- Requires the gateway API to be reachable from the browser
- The gateway serves the built SPA; this module does not self-host in production

## Read Next

- [agents-gateway-http](../../core/README.md) - REST API this UI consumes
- [agents-runtime](../../../runtime/core/README.md) - execution engine behind the gateway
