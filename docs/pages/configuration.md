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
| `AGENTS_DATA_DIR` | `~/.agents` | Persistent storage for memory extension |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | Pi SDK data directory (sessions, config) |

## Optional (enable features)

| Variable | Purpose |
|----------|---------|
| `LUCY_API_KEY` | Protects `/api/*` routes with Bearer token auth |
| `PI_BRIDGE_PROVIDER` | Pi SDK provider override |
| `PI_BRIDGE_PROMPT` | Path to system prompt file (default: `prompt.md`) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (also needs `TELEGRAM_CHAT_ID`) |
| `TELEGRAM_CHAT_ID` | Single Telegram chat ID to allow |

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start with hot reload |
| `npm run typecheck` | Type-check all modules |
| `npm run build` | Build static assets |
