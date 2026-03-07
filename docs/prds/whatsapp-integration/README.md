---
status: draft
date: 2026-03-07
author: kuba
gh-issue: ""
---

# WhatsApp Integration

## Problem

Lucy agents are currently only accessible through the HTTP gateway (REST API) and the web UI. There's no way to interact with an agent from a messaging app you already use daily. Having to open a separate web app creates friction — especially for quick questions or on-the-go interactions. A WhatsApp integration would let users chat with their agent from a familiar interface they already have open.

## Proposed Solution

Add a **gateway plugin system** to `agents-gateway-http` and implement WhatsApp as the first gateway plugin. This mirrors the existing runtime plugin pattern — the gateway exposes a plugin interface where plugins can register additional Hono routes during initialization.

The WhatsApp plugin:
1. Registers webhook routes on the existing Hono app (`GET /whatsapp/webhook` for Meta's verification challenge, `POST /whatsapp/webhook` for inbound messages)
2. Checks incoming phone numbers against a configured allowlist
3. Maps allowed phone numbers to runtime sessions (auto-creates on first contact)
4. Calls `runtime.sendMessage()` and relays the response back via WhatsApp Cloud API

The gateway plugin `onInit` receives the full `AgentRuntime` instance — the runtime interface is small enough (`sendMessage`, `createSession`, `getSession`) that a narrower wrapper isn't needed. Every gateway (HTTP, CLI, WhatsApp) is just a thin transport that calls the runtime.

The webhook handler must respond 200 to Meta immediately and process messages asynchronously — `sendMessage()` is blocking and can take 5-30s depending on the model, while Meta requires a response within 20 seconds.

This keeps WhatsApp as a thin adapter — no business logic, just message transport. Future messaging integrations (Telegram, Slack) follow the same gateway plugin pattern.

### Configuration shape (in `lucy.config.json`)

```json
{
  "agents-gateway-http": {
    "plugins": {
      "enabled": ["whatsapp"],
      "configById": {
        "whatsapp": {
          "phoneNumberId": "FROM_META_DASHBOARD",
          "verifyToken": "YOUR_VERIFY_TOKEN",
          "allowedNumbers": ["+48123456789"]
        }
      }
    }
  }
}
```

The WhatsApp API access token is read from the `WHATSAPP_API_TOKEN` env var (never stored in config).

## Key Cases

- **Inbound text message**: User sends a WhatsApp message -> gateway receives webhook -> responds 200 immediately -> plugin checks phone number against allowlist -> finds or creates session for that number -> calls `runtime.sendMessage()` async -> sends agent reply back via WhatsApp Cloud API
- **Phone number allowlist**: Only numbers in `allowedNumbers` config are accepted. Messages from unknown numbers are silently dropped
- **Webhook verification**: Meta sends a GET challenge on setup -> plugin responds with the correct `hub.challenge` value using the configured `verifyToken`
- **Session continuity**: Messages from the same allowed phone number route to the same session, preserving conversation history. If a mapped session no longer exists (data dir wiped), auto-create a fresh one
- **Message deduplication**: Track recently-seen Meta message IDs in a simple in-memory cache (TTL-based). Drop duplicates from Meta retries
- **Status webhook filtering**: Meta sends delivery status updates (sent, delivered, read) to the same POST endpoint. Identify and ignore these — only process actual inbound messages
- **Long responses**: Agent replies exceeding WhatsApp's 4096-char limit are split into multiple messages
- **Error handling**: If the runtime errors, send a short fallback message via WhatsApp ("Something went wrong, try again")
- **Gateway plugin lifecycle**: Plugin registers routes during `onInit` (receives Hono app + AgentRuntime), cleans up during `onDestroy`. Gateway loads enabled plugins from config at startup

## Out of Scope

- Media messages (images, audio, video, documents) — text only for now
- Group chat support
- Multiple agents per phone number (one number = one agent config)
- Multi-user support (single-user with allowlist for now; multi-user deferred)
- Read receipts or typing indicators
- Proactive/outbound messaging (agent-initiated)
- End-to-end encryption beyond what WhatsApp provides natively
- Web UI configuration of the WhatsApp integration

## Future Improvements

- **Webhook signature verification**: Meta signs POST payloads with `X-Hub-Signature-256` using the app secret. Should be added for production hardening to prevent forged webhook requests
- **Concurrent message queueing**: If a user sends two messages quickly, the second may arrive while the first is still processing. A per-session queue would prevent race conditions in conversation history. Low priority for single-user, low-volume usage

## Open Questions

- **Phone-to-session mapping store**: Simple JSON file (consistent with file-based adapters) or in-memory map with persistence? The volume is low (single user), so a JSON file is likely fine

## References

- [WhatsApp Business Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- `agents-gateway-http/src/server.ts` — Hono app where plugin routes would be mounted
- `agents-gateway-http/src/plugins.ts` — existing runtime plugin registry (gateway plugin system would be separate)
- `agents-runtime/src/types/plugins.ts` — runtime plugin interface to mirror for gateway plugins
- `agents-runtime/src/runtime/agent-runtime.ts` — `sendMessage()` and `createSession()` entry points
- `lucy.config.json` — declarative configuration
