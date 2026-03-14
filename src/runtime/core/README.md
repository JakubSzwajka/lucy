---
title: Runtime
section: Runtime
subsection: Core
order: 1
---

# agents-runtime

RPC client wrapping the Pi SDK agent via the [pi-bridge](./src/pi-bridge/README.md) Unix socket.

## Public API

```ts
AgentRuntime   // init(), sendMessage(), sendMessageStreaming(), getHistory(), getModels(), getSessionInfo(), abort(), destroy(), subscribe()
```

Types: `ModelConfig`, `HistoryEntry`, `SessionInfo`, `StreamEvent`.

## Activation

Construct `AgentRuntime`, call `init()`, then send requests over the bridge socket. The gateway owns process startup and shutdown.

## Use It Like This

```ts
const runtime = new AgentRuntime();
await runtime.init(); // connects to pi-bridge socket
const { response } = await runtime.sendMessage("Hello");
```

## Prompt Context

Dynamic system prompt context (time, memory, questions) is handled by a **Pi extension** at `.pi/extensions/prompt-context.ts`. The extension uses `before_agent_start` to append dynamic sections to the system prompt at runtime — no file mutation needed.

The base `PROMPT.md` stays static. The TASKS section is managed separately by the tasks skill (writes markers directly into PROMPT.md).

## Configuration

`AgentRuntime` is configured entirely via environment variables (see `.env.example`). The socket path defaults to `/tmp/lucy-pi.sock` and can be overridden with `PI_BRIDGE_SOCKET`.

| Env var | Default | Description |
|---------|---------|-------------|
| `PI_BRIDGE_SOCKET` | `/tmp/lucy-pi.sock` | Unix socket for bridge ↔ gateway IPC |

## Responsibility Boundary

- **Owns**: RPC connection to pi-bridge, message/history translation
- **Delegates**: agent execution to Pi SDK (in pi-bridge process), HTTP transport to gateway, prompt context injection to Pi extension

## Operational Constraints

- Requires a running pi-bridge process on `PI_BRIDGE_SOCKET`
- Per-request `modelId` and `thinkingEnabled` are accepted but currently ignored with a warning

## Context & Compaction

Pi auto-compacts when context nears the model's limit. For Sonnet 4 (200k context), compaction triggers at ~183k tokens (200k - 16k reserve). To check current context size:

```bash
tail -20 .agents/pi/sessions/--app--/*.jsonl | \
  jq -r 'select(.message.role=="assistant") | .message.usage | "\(.input + .cacheRead) tokens in context"' | tail -1
```

Note: `get_session_stats` RPC returns **cumulative** token totals across the whole session, not current context size. The actual context size is the `input + cacheRead` from the most recent assistant message.

## Known Limitations

- Reconnect logic only restores bridge connectivity; it does not recreate bridge state
- History translation only emits user and assistant messages

## Read Next

- [pi-bridge](./src/pi-bridge/README.md) — separate process that spawns and manages the Pi SDK
- [gateway/core](../../gateway/core/README.md) — HTTP gateway that wraps this runtime
