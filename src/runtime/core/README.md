---
title: Runtime
section: Runtime
order: 1
---

# agents-runtime

RPC client wrapping the Pi SDK agent via the [pi-bridge](../pi-bridge/) Unix socket. Provides `sendMessage()`, `getHistory()`, `getModels()`, and `abort()` over JSONL.

## Public API

```ts
AgentRuntime   // init(), sendMessage(), getHistory(), getModels(), abort(), destroy()
```

Types: `ModelConfig`, `HistoryEntry`.

## Use It Like This

```ts
const runtime = new AgentRuntime();
await runtime.init(); // connects to pi-bridge socket
const { response } = await runtime.sendMessage("Hello");
```

## Configuration

`AgentRuntime` is configured entirely via environment variables (see `.env.example`). The socket path defaults to `/tmp/lucy-pi.sock` and can be overridden with `PI_BRIDGE_SOCKET`.

## Responsibility Boundary

Owns the RPC connection to pi-bridge and message/history translation. Delegates agent execution to Pi SDK (running in the pi-bridge process) and HTTP transport to gateway.

## Known Limitations

- **Per-request model/thinking** — Pi SDK uses session-level config; per-request overrides log a warning
- **compactionSummary** — always `null` in `getHistory()`

## Read Next

- [pi-bridge](../pi-bridge/) — separate process that spawns and manages the Pi SDK
- [gateway/core](../../gateway/core/README.md) — HTTP gateway that wraps this runtime
- [memory extension](../extensions/memory/README.md) — Pi extension for memory/observation
