---
title: Telegram Integration
section: Gateway
order: 5
---

# agents-plugin-telegram

Gateway plugin that bridges Telegram Bot API with the agent runtime. Receives inbound messages via Telegram webhooks, routes them to `AgentRuntime.sendMessage()`, and replies via the Bot API.

## Setup

### 1. Create a Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts (pick a name and username)
3. BotFather replies with your **bot token** — save it

### 2. Configure Lucy

Add to `lucy.config.json`:

```json
{
  "telegram": {
    "allowedChatIds": [123456789]
  }
}
```

Set the bot token as an env var (never in config):

```bash
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
```

| Field | Description |
|-------|-------------|
| `allowedChatIds` | Array of Telegram chat IDs allowed to interact. Empty array `[]` allows all. |

**Finding your chat ID:** Message your bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates` — your chat ID is in `message.chat.id`.

### 3. Register the Webhook

Once Lucy is deployed and publicly accessible, register the webhook with Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/telegram/webhook"}'
```

Expected response:

```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

To verify:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

To remove:

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
- Verify your chat ID is in `allowedChatIds` (or set to `[]` to allow all)
- Check gateway logs for `[telegram]` entries

**Webhook not receiving updates:**
- Telegram requires HTTPS with a valid certificate
- The URL must be publicly reachable (no localhost)
- Use `ngrok` or similar for local development

**Markdown parse errors:**
- The plugin sends responses with `parse_mode: "Markdown"`. If the agent response contains unbalanced markdown characters, Telegram may reject it. Check logs for 400 errors.

## Responsibility Boundary

Owns Telegram webhook handling, chat ID filtering, message deduplication, and response splitting. All agent logic is delegated to the runtime via `sendMessage()`.
