---
title: Telegram Integration
section: Gateway
subsection: Extensions
order: 12
---

# agents-plugin-telegram

Gateway plugin that bridges Telegram Bot API with the agent runtime. Receives inbound messages via Telegram webhooks, routes them to `AgentRuntime.sendMessage()`, and replies via the Bot API.

## Activation

The gateway mounts Telegram routes only when `TELEGRAM_BOT_TOKEN` is set. `TELEGRAM_CHAT_ID` specifies a single allowed chat; when unset, all chats are allowed.

## Configuration

| Env var | Required | Purpose |
|---------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token used for webhook handling and replies |
| `TELEGRAM_CHAT_ID` | No | Single numeric chat ID to allow |

## Register the Webhook

```bash
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="123456789"
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/telegram/webhook"}'
```

Verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Remove:

```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/telegram/webhook` | Inbound Telegram updates |

## Troubleshooting

**Bot doesn't respond:**
- Check `getWebhookInfo` — look for `last_error_message`
- Verify `TELEGRAM_BOT_TOKEN` is set in the environment
- Verify your chat ID matches `TELEGRAM_CHAT_ID` (or leave it unset to allow all)
- Check gateway logs for `[telegram]` entries

**Webhook not receiving updates:**
- Telegram requires HTTPS with a valid certificate
- The URL must be publicly reachable (no localhost)
- Use `ngrok` or similar for local development

**Markdown parse errors:**
- The plugin sends responses with `parse_mode: "Markdown"`. If the agent response contains unbalanced markdown characters, Telegram may reject it. Check logs for 400 errors.

## Responsibility Boundary

Owns Telegram webhook handling, chat ID filtering, message deduplication, and response splitting. All agent logic is delegated to the runtime via `sendMessage()`.

## Operational Constraints

- Requires a public HTTPS endpoint for Telegram webhooks
- Mounts only when `TELEGRAM_BOT_TOKEN` is present at gateway boot
- Telegram rendering can fail on malformed Markdown in agent responses

## Read Next

- [agents-gateway-http](../../core/README.md) - server that mounts this plugin
- [agents-runtime](../../../runtime/core/README.md) - runtime invoked for each Telegram message
