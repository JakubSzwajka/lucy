---
title: Pi Bridge
section: Runtime
order: 2
---

# pi-bridge

Separate long-lived process that spawns the Pi SDK in RPC mode and exposes it over a Unix socket. Survives gateway hot-reloads so agent turns are never interrupted.

## Configuration

| Env var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PI_BRIDGE_MODEL` | **Yes** | — | Model identifier (e.g. `openrouter/anthropic/claude-sonnet-4`) |
| `PI_BRIDGE_SOCKET` | No | `/tmp/lucy-pi.sock` | Unix socket path |
| `PI_BRIDGE_PROVIDER` | No | — | Provider override |
| `PI_BRIDGE_PROMPT` | No | `prompt.md` | Path to file appended to Pi's system prompt |
| `PI_CODING_AGENT_DIR` | No | `~/.pi/agent` | Pi SDK data dir (sessions, config) — native Pi env var |

## Responsibility Boundary

Owns Pi SDK process lifecycle and Unix socket server. Passes JSONL messages bidirectionally between one gateway client and the Pi child process. Does not interpret messages.

## Read Next

- [agents-runtime](../core/README.md) — RPC client that connects to this bridge
