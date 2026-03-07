# agents-webui

React chat UI for the `agents-gateway-http` REST API. Built with Vite, Tailwind CSS, and shadcn/ui components.

## Quick Start

```bash
npm install
npm run dev          # Vite dev server, default port 5173
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

## Read Next

- [agents-gateway-http](../agents-gateway-http/README.md) - REST API this UI consumes
- [agents-runtime](../agents-runtime/README.md) - execution engine behind the gateway
