---
status: draft
date: 2026-03-16
author: "kuba"
---

# Migrate Pi integration from RPC bridge to SDK embedding

## Problem

Lucy's runtime communicates with Pi through a subprocess bridge: the gateway spawns `pi --mode rpc` as a child process, then talks to it over a Unix socket using a custom JSON-RPC protocol. This architecture has three problems:

1. **No hot reload.** Pi's extension system (`.pi/extensions/`) supports in-process hot reload via `ctx.reload()`, but the bridge can't use it — Pi is isolated in a subprocess with no extension API access.
2. **Fragile process chain.** If Pi dies, the bridge exits, which crashes the gateway. Reconnection logic exists but can't restore session state mid-conversation.
3. **Unnecessary complexity.** ~800 lines of socket server, RPC protocol, event normalization, and reconnection logic replicate what the Pi SDK provides as direct method calls.

The agent's ability to evolve its own behavior at runtime (self-modifying extensions) is a core requirement. The bridge architecture makes this impossible.

## Proposed Solution

Replace the subprocess bridge with direct Pi SDK embedding. Import `createAgentSession` from `@mariozechner/pi-coding-agent`, instantiate the session in-process, and expose it through the existing `AgentRuntime` interface. The gateway, runtime, and Pi all live in a single process.

The public API (`sendMessage`, `sendMessageStreaming`, `getHistory`, `subscribe`, etc.) stays identical — only the internals change. Extensions (memory, telegram, webui) continue working against the same `AgentRuntime` interface.

Pi's built-in extension system becomes the agent's evolvable surface: tools, prompts, and behaviors live in `.pi/extensions/` and hot-reload without process restart.

## Key Cases

- **Session creation:** `createAgentSession()` with `DefaultResourceLoader`, `SessionManager`, model config from env vars
- **Streaming:** `session.subscribe()` events normalized to existing `StreamEvent` types
- **History retrieval:** `session.messages` mapped to `HistoryEntry[]` (replaces `get_messages` RPC)
- **Session continuity:** `SessionManager.continueRecent()` on gateway restart picks up last session
- **Abort:** `session` abort mechanism replaces `abort` RPC command
- **Hot reload:** Agent writes `.pi/extensions/*.ts`, calls `/reload`, new behavior loads in-place
- **Extension state:** `pi.appendEntry()` persists custom data across reloads in session JSONL

## Out of Scope

- Splitting into two processes (runtime + gateway) — single process is sufficient since agent self-modification targets extensions, not application code
- Migrating the memory extension to Pi's native extension format (separate PRD)
- Adding new Pi extension capabilities beyond what the current bridge exposes
- Changing the gateway HTTP API or WebSocket protocol

## Open Questions

- What Pi SDK version to pin? Current `@mariozechner/pi-coding-agent: *` is unpinned
- Does `SessionManager.continueRecent()` restore full conversation context including tool results, or just messages?
- How does `DefaultResourceLoader` interact with Lucy's existing `.agents/` directory structure — do we adopt `.pi/` conventions or configure custom paths?
- Should the `PROMPT.md` / system prompt be injected via `systemPromptOverride` on the ResourceLoader or as a Pi extension?

## References

- [Pi SDK docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md) — `createAgentSession` API, ResourceLoader, SessionManager
- [Pi Extensions docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md) — hot reload, `ctx.reload()`, extension lifecycle
- [OpenClaw Pi integration](https://docs.openclaw.ai/pi) — reference SDK embedding implementation
- `src/runtime/core/src/pi-bridge/` — current bridge code to replace
- `src/runtime/core/src/runtime/agent-runtime.ts` — public API to preserve
- `src/runtime/core/src/runtime/socket-client.ts` — RPC client to delete
