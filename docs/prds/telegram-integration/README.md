---
status: draft
date: 2026-03-10
author: kuba
gh-issue: ""
---

# Telegram Bot Integration

## Problem

Lucy currently only supports WhatsApp as a messaging channel, and WhatsApp's production setup is painful — business verification, phone number provisioning, expiring tokens, and Meta's opaque error messages. Telegram offers a drastically simpler bot API: create a bot with BotFather, get a permanent token, set a webhook, done. Adding Telegram as a second channel gives Lucy a reliable, easy-to-configure messaging integration.

## Proposed Solution

Create a new gateway extension at `gateway/extensions/telegram/` that mirrors the WhatsApp plugin architecture. It will use the Telegram Bot API to receive messages via webhook and send responses back. The plugin follows the same factory pattern (`createTelegramPlugin()`), same handler pipeline (allowlist, dedup, runtime call, split, send), and same conditional loading in the gateway core. Config lives in `lucy.config.json` under a `telegram` key, bot token in an env var.

## Key Cases

- Receive text messages from Telegram users via webhook
- Send agent responses back, splitting long messages at Telegram's 4096-char limit
- Deduplicate webhook deliveries (Telegram retries on non-200)
- Allowlist by chat ID to restrict access
- Webhook verification endpoint for Telegram's `setWebhook` call
- Graceful handling of non-text messages (photos, stickers, etc.) — ignore with no error

## Out of Scope

- Inline keyboards, callback queries, or rich message types
- Group chat support (1:1 only for now)
- Telegram-specific features (reactions, threads, pinned messages)
- Bot commands menu (`/start`, `/help` etc. — treat all text equally)
- Media message handling (images, voice, files)

## Open Questions

- Should we auto-register the webhook on plugin init (call `setWebhook` API), or require manual setup? Auto-register is simpler but needs the public URL.

## References

- [Telegram Bot API docs](https://core.telegram.org/bots/api)
- Existing WhatsApp plugin: `gateway/extensions/whatsapp/`
- Gateway plugin loading: `gateway/core/src/index.ts`
