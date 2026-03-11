---
title: WhatsApp Integration
section: Gateway
order: 3
---

# agents-plugin-whatsapp

Gateway plugin that bridges WhatsApp Business Cloud API with the agent runtime. Receives inbound WhatsApp messages via Meta webhooks, routes them to `AgentRuntime.sendMessage()`, and replies via the WhatsApp API.

## Configuration

In `lucy.config.json` under `agents-gateway-http.plugins`:

```json
{
  "whatsapp": {
    "phoneNumberId": "FROM_META_DASHBOARD",
    "verifyToken": "YOUR_VERIFY_TOKEN",
    "allowedNumbers": ["48123456789"]
  }
}
```

Requires `WHATSAPP_API_TOKEN` env var (never stored in config).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/whatsapp/webhook` | Meta webhook verification challenge |
| `POST` | `/whatsapp/webhook` | Inbound messages and status updates |

## Responsibility Boundary

Owns WhatsApp webhook handling, phone-to-session mapping, message deduplication, and response splitting. All agent logic is delegated to the runtime via `sendMessage()` / `createSession()`.

## Read Next

- [agents-gateway-http](../agents-gateway-http/README.md) - gateway this plugin mounts on
- [agents-runtime](../agents-runtime/README.md) - runtime providing agent execution
- [PRD](../docs/prds/whatsapp-integration/README.md) - design document
