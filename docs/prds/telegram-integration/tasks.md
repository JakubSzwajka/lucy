---
prd: telegram-integration
generated: 2026-03-10
last-updated: 2026-03-10
---

# Tasks: Telegram Bot Integration

> Summary: Add a Telegram bot extension to the gateway, mirroring the WhatsApp plugin architecture. 7 tasks, first 3 are parallelizable.

## Task List

- [ ] **1. Scaffold module with config and package.json** — create directory structure, config type, and package metadata
- [ ] **2. Implement TelegramClient** — HTTP client for Telegram Bot API (sendMessage)
- [ ] **3. Implement message splitter** — reuse or adapt WhatsApp's 4096-char splitter
- [ ] **4. Add webhook routes** — GET health + POST handler for Telegram updates `[blocked by: 1]`
- [ ] **5. Implement message handler** — allowlist, dedup, runtime call, split, send pipeline `[blocked by: 1, 2, 3]`
- [ ] **6. Wire into gateway core** — conditional plugin loading + config type extension `[blocked by: 4, 5]`
- [ ] **7. Add README with full setup instructions** — BotFather setup, config, webhook registration `[blocked by: 6]`

---

### 1. Scaffold module with config and package.json
<!-- status: pending -->

Create `gateway/extensions/telegram/` with the same structure as the WhatsApp plugin. Add `package.json` (private, name `agents-plugin-telegram`), `src/index.ts` with the `createTelegramPlugin()` factory stub, and `src/config.ts` with the `TelegramConfig` interface. Add a tsconfig path alias `"agents-plugin-telegram"` pointing to `gateway/extensions/telegram/src/index.ts`.

**Files:** `gateway/extensions/telegram/package.json`, `gateway/extensions/telegram/src/index.ts`, `gateway/extensions/telegram/src/config.ts`, `tsconfig.json`
**Depends on:** —
**Validates:** `npm run typecheck` passes, config type is importable from the alias

---

### 2. Implement TelegramClient
<!-- status: pending -->

Create `TelegramClient` class mirroring `WhatsAppClient`. Single method `sendMessage(chatId: number, text: string)` that POSTs to `https://api.telegram.org/bot{token}/sendMessage` with `{ chat_id, text, parse_mode: "Markdown" }`. Log errors but don't throw, matching WhatsApp's resilience pattern.

**Files:** `gateway/extensions/telegram/src/telegram-client.ts`
**Depends on:** —
**Validates:** Class compiles, method signature matches Telegram Bot API `sendMessage` endpoint

---

### 3. Implement message splitter
<!-- status: pending -->

Telegram's message limit is 4096 chars — same as WhatsApp. Evaluate whether `message-splitter.ts` from the WhatsApp module can be extracted to a shared location or simply copied. If the logic is identical (it likely is), copy and re-export. Keep it simple — no shared utility package unless there's a third consumer.

**Files:** `gateway/extensions/telegram/src/message-splitter.ts`
**Depends on:** —
**Validates:** Splits text >4096 chars into chunks, preserves paragraph/sentence breaks

---

### 4. Add webhook routes
<!-- status: pending -->

Create `src/routes/webhook.ts` with a single `POST /telegram/webhook` route. Parse Telegram's `Update` object: extract `message.chat.id`, `message.message_id`, and `message.text`. Ignore non-text updates (edits, photos, stickers) silently. Return 200 immediately and process async, same pattern as WhatsApp. No GET verification needed — Telegram doesn't challenge webhooks.

**Files:** `gateway/extensions/telegram/src/routes/webhook.ts`
**Depends on:** 1
**Validates:** Route mounts on Hono app, correctly parses a sample Telegram update payload

---

### 5. Implement message handler
<!-- status: pending -->

Create `src/handler.ts` with `handleInboundMessage()` following the WhatsApp handler pipeline: allowlist check (by chat ID), dedup check (by message ID), `runtime.sendMessage(text)`, split response, send chunks via `TelegramClient`. Log one summary line per message. On error, send a user-friendly message back. Reuse `DedupCache` from WhatsApp (copy the class — it's 20 lines).

**Files:** `gateway/extensions/telegram/src/handler.ts`, `gateway/extensions/telegram/src/dedup-cache.ts`
**Depends on:** 1, 2, 3
**Validates:** Handler processes a text message end-to-end, blocked numbers are rejected, duplicates are skipped

---

### 6. Wire into gateway core
<!-- status: pending -->

Add `telegram` to the gateway config type (optional key, like `whatsapp`). Add conditional loading in `gateway/core/src/index.ts`: `if (config.telegram) { createTelegramPlugin().onInit(...) }`. Add env var `TELEGRAM_BOT_TOKEN` reading in the plugin init. Update `lucy.config.json` example/types to include the `telegram` section.

**Files:** `gateway/core/src/index.ts`, `gateway/core/src/config.ts` (or wherever GatewayConfig is defined)
**Depends on:** 4, 5
**Validates:** Gateway starts with `telegram` config present, plugin initializes, webhook endpoint responds

---

### 7. Add README with full setup instructions
<!-- status: pending -->

Write `gateway/extensions/telegram/README.md` with complete setup guide: (1) Create bot via BotFather, (2) Copy token to `TELEGRAM_BOT_TOKEN` env var, (3) Add `telegram` config to `lucy.config.json`, (4) Deploy and register webhook via `curl` to Telegram's `setWebhook` API. Include example config, example curl commands, and troubleshooting tips (wrong token, webhook not receiving, allowed chats filtering).

**Files:** `gateway/extensions/telegram/README.md`
**Depends on:** 6
**Validates:** A new user can follow the README end-to-end to get a working Telegram bot
