# Lucy

Single-package agent infrastructure app. Runtime and gateway code live under `src/`; the archived Next.js reference app lives in `.legacy/`.

## Structure

| Area | Purpose |
|------|---------|
| [`src/runtime/core/README.md`](./src/runtime/core/README.md) | RPC client for the Pi bridge |
| [`src/runtime/extensions/memory/README.md`](./src/runtime/extensions/memory/README.md) | Pi memory extension |
| [`src/gateway/core/README.md`](./src/gateway/core/README.md) | Hono HTTP gateway |
| [`src/gateway/extensions/webui/README.md`](./src/gateway/extensions/webui/README.md) | React chat UI mounted by the gateway |
| [`src/gateway/extensions/landing-page/README.md`](./src/gateway/extensions/landing-page/README.md) | Astro marketing/docs site mounted by the gateway |
| [`src/gateway/extensions/telegram/README.md`](./src/gateway/extensions/telegram/README.md) | Telegram webhook integration |
| [`docs/decisions/README.md`](./docs/decisions/README.md) | Architecture decision index |

## Run

```bash
npm install
npm run dev
```

`npm run dev` starts both the Pi bridge and the HTTP gateway. Build static gateway assets with `npm run build`.

## Configuration

Configuration is env-driven. The main runtime contract is:

| Env var | Purpose |
|---------|---------|
| `PI_BRIDGE_MODEL` | Required model id for the Pi bridge |
| `OPENROUTER_API_KEY` | Provider auth for the bridge runtime |
| `PORT` | Gateway port, default `3080` |
| `PI_BRIDGE_SOCKET` | Unix socket path, default `/tmp/lucy-pi.sock` |
| `CORS_ORIGIN` | CORS allowlist, default `*` |
| `LUCY_API_KEY` | Protects `/api/chat*` when set |
| `AGENTS_DATA_DIR` | Persistent data for memory and related state |
| `TELEGRAM_BOT_TOKEN` | Enables Telegram webhook integration |
| `TELEGRAM_CHAT_ID` | Optional single Telegram chat ID to allow |

## Read Next

- [Runtime Core](./src/runtime/core/README.md)
- [Gateway Core](./src/gateway/core/README.md)
- [Development Notes](./CLAUDE.md)
