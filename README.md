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

Configuration is env-driven. Copy `.env.example` to `.env` and fill in required values.

**Required:**

| Env var | Purpose |
|---------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls |
| `PI_BRIDGE_MODEL` | Model identifier (e.g. `openrouter/anthropic/claude-sonnet-4`) |

**Optional (have defaults):**

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `3080` | Gateway HTTP port |
| `PI_BRIDGE_SOCKET` | `/tmp/lucy-pi.sock` | Unix socket for bridge ↔ gateway IPC |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | Pi SDK data directory — set to `.agents/pi` in Docker |

**Optional (enable features):**

| Env var | Purpose |
|---------|---------|
| `LUCY_API_KEY` | Protects `/api/*` routes with Bearer token auth |
| `PI_BRIDGE_PROVIDER` | Pi SDK provider override (e.g. `anthropic`) |
| `PI_BRIDGE_PROMPT` | Path to system prompt file (default: `prompt.md`) |
| `TELEGRAM_BOT_TOKEN` | Enables Telegram webhook integration |
| `TELEGRAM_CHAT_ID` | Single Telegram chat ID to allow |

## Docker

```bash
make up        # docker compose with hot reload
make down      # stop containers
```

All persistent data lives under `.agents/` — mounted at `/app/.agents` in Docker. Pi SDK sessions and auth go to `.agents/pi/`. The `make up` target auto-syncs `~/.pi/agent/auth.json` into `.agents/pi/` for OAuth providers.

## Read Next

- [Runtime Core](./src/runtime/core/README.md)
- [Gateway Core](./src/gateway/core/README.md)
- [Development Notes](./CLAUDE.md)
