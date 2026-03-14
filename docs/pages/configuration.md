---
title: Configuration
section: General
order: 2
---

# Configuration

Lucy is configured entirely via environment variables. Copy `.env.example` to `.env` and fill in the required values.

## Required

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls (Pi SDK) |
| `PI_BRIDGE_MODEL` | Model identifier (e.g. `openrouter/anthropic/claude-sonnet-4`) |

## Optional (have defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3080` | Gateway HTTP port |
| `PI_BRIDGE_SOCKET` | `/tmp/lucy-pi.sock` | Unix socket for pi-bridge ↔ gateway IPC |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | Pi SDK data directory (sessions, config) — set to `.agents/pi` in Docker |

## Optional (enable features)

| Variable | Purpose |
|----------|---------|
| `LUCY_API_KEY` | Protects `/api/*` routes with Bearer token auth |
| `PI_BRIDGE_PROVIDER` | Pi SDK provider override |
| `PI_BRIDGE_PROMPT` | Path to system prompt file (default: `prompt.md`) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (also needs `TELEGRAM_CHAT_ID`) |
| `TELEGRAM_CHAT_ID` | Single Telegram chat ID to allow |

## Data Directory

All persistent data lives under `.agents/` in the project root:

```
.agents/
├── pi/              # Pi SDK data (sessions, auth, config)
│   ├── auth.json    # OAuth credentials (synced from ~/.pi/agent/)
│   └── sessions/    # Session JSONL files
├── memory/          # Agent memory (MEMORY.md, reflections)
├── skills/          # Agent skills
└── tasks/           # Task board (board.json)
```

In Docker, `.agents/` is mounted at `/app/.agents`. The `make up` target auto-syncs `~/.pi/agent/auth.json` into `.agents/pi/` for OAuth-based providers.

## Docker

```bash
make up          # Build and start via docker compose
make down        # Stop containers
make docker-build  # Build image only
```

Docker Compose forwards all env vars from `.env`. Key overrides inside the container:

| Variable | Container value | Why |
|----------|----------------|-----|
| `PI_CODING_AGENT_DIR` | `/app/.agents/pi` | Routes Pi data into the mounted volume |
| `PI_BRIDGE_PROMPT` | `prompt.md` | Resolved relative to `/app` (WORKDIR) |

## Railway Deployment

```bash
make deploy          # Set vars + deploy
make deploy-secrets  # Set vars only
```

Railway uses a `/data` volume. `PI_CODING_AGENT_DIR` is set to `/data/pi`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start with hot reload |
| `npm run typecheck` | Type-check all modules |
| `npm run build` | Build static assets |
