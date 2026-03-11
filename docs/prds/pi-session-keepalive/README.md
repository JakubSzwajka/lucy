---
status: draft
date: 2026-03-11
author: "kuba"
gh-issue: ""
---

# Pi Session Keepalive — Survive Hot Reload

## Problem

When the agent modifies a file during execution, `tsx watch` detects the change and restarts the entire Node process. This kills the Pi SDK session mid-task. The session history is persisted to disk and survives, but the **active agent turn dies** — nobody re-sends the message, so the agent sits idle with no awareness that it was interrupted.

This makes self-modification impossible: the agent can't edit code, see the result, and continue — because the edit kills the process running the agent.

The root cause: the Pi SDK session and the gateway code live in the **same process**. The file watcher can't distinguish "agent changed a file" from "developer changed a file."

## Proposed Solution

Separate the Pi SDK session into its own long-lived process that the gateway talks to over a **unix socket**. The gateway (with `tsx watch`) can restart freely — the Pi process keeps running, keeps the session alive, and keeps processing the current turn.

Three components:

1. **pi-bridge** — a tiny daemon (~50-100 lines) that spawns `pi --mode rpc` and exposes it over a unix socket at `/tmp/lucy-pi.sock`. Never watched, never restarted by dev tooling.

2. **runtime client** — replaces direct `AgentSession` usage in the gateway. Connects to the unix socket, sends JSONL commands, receives JSONL events. Reconnects automatically after gateway restart.

3. **`npm run dev` orchestration** — starts pi-bridge first, then gateway with `tsx watch`. Only the gateway restarts on file changes.

The protocol between gateway and pi-bridge is **Pi's own RPC protocol** (`pi --mode rpc`) — we don't invent anything. We just transport it over a unix socket instead of stdio.

### How it works

```
Developer edits a file
  → tsx watch restarts gateway
    → pi-bridge still running, pi still running
      → gateway reconnects to /tmp/lucy-pi.sock
        → if pi was mid-turn, gateway picks up remaining events
        → if pi finished, gateway can query history

Agent edits a file
  → tsx watch restarts gateway (same as above)
    → pi-bridge still running
      → pi finishes the turn undisturbed
        → gateway reconnects, picks up result
```

### What is a unix socket?

A unix socket is just a **file path that two processes use as an address to find each other** (like `localhost:3081` but as a file path instead of IP+port). No actual data goes through the filesystem — it flows through memory via the OS kernel. Faster than HTTP, same mental model: one side listens, the other connects, they exchange bytes.

In Node.js, it's the same API as HTTP — `net.createServer().listen("/tmp/lucy-pi.sock")` instead of `.listen(3081)`.

### What is Pi's RPC mode?

Pi has a built-in headless mode (`pi --mode rpc`) that accepts JSONL commands on stdin and streams JSONL events on stdout. The full protocol is documented at `github.com/badlogic/pi-mono/packages/coding-agent/docs/rpc.md`. Key commands:

| Command | What it does |
|---------|-------------|
| `prompt` | Send a message, get streaming events back |
| `abort` | Cancel current turn |
| `get_state` | Check if busy/idle, session info |
| `get_messages` | Get conversation history |
| `steer` | Interrupt agent mid-turn with new instruction |
| `follow_up` | Queue message for after current turn finishes |

Events stream back as JSONL: `text_delta` (tokens), `tool_execution_*` (tool use), `agent_end` (turn done).

## Key Cases

- **Gateway restarts while agent is idle** — gateway reconnects to socket, queries state, continues normally
- **Gateway restarts while agent is mid-turn** — pi-bridge buffers events; gateway reconnects and picks up remaining events or queries the completed result
- **Agent edits a watched file** — gateway restarts, pi keeps going, gateway reconnects after restart
- **Developer edits gateway code** — same as above, hot reload works as expected
- **pi-bridge crashes or is stopped** — gateway detects socket gone, logs error, waits for bridge to come back
- **First startup (no bridge running)** — `npm run dev` starts bridge first, gateway waits for socket to appear

## Out of Scope

- Multi-user session isolation (separate concern, different PRD)
- Streaming tokens to the UI via SSE (can be layered on after, uses the same event stream)
- Runtime code hot-reload (reloading agent logic without restarting pi — future optimization)
- Production deployment changes (this is a dev-mode concern; prod doesn't use tsx watch)

## Open Questions

- Should pi-bridge buffer completed results when gateway is disconnected, or should gateway just call `get_messages` on reconnect to catch up?
- Should `npm run dev` use `concurrently`, a shell script, or something else to orchestrate the two processes?
- When developer edits runtime code (not gateway code), should there be a way to gracefully restart pi after its current turn completes?

## References

- Pi RPC protocol: `github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md`
- Pi RPC client reference: `packages/coding-agent/src/modes/rpc/rpc-client.ts` in pi-mono
- Current runtime: `src/runtime/core/src/runtime/agent-runtime.ts`
- Current gateway entry: `src/gateway/core/src/index.ts`
- Current runtime singleton: `src/gateway/core/src/runtime.ts`
