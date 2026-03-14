---
title: Runtime
section: Runtime
subsection: Core
order: 1
---

# agents-runtime

RPC client wrapping the Pi SDK agent via the [pi-bridge](./src/pi-bridge/README.md) Unix socket, with prompt composition for dynamic system prompt injection.

## Public API

```ts
AgentRuntime   // init(), sendMessage(), sendMessageStreaming(), getHistory(), getModels(), getSessionInfo(), abort(), destroy(), subscribe()
```

Types: `PromptContext`, `RequestSource`, `ModelConfig`, `HistoryEntry`, `SessionInfo`, `StreamEvent`.

## Activation

Construct `AgentRuntime`, call `init()`, then send requests over the bridge socket. The gateway owns process startup and shutdown.

## Use It Like This

```ts
const runtime = new AgentRuntime();
await runtime.init(); // connects to pi-bridge socket
const { response } = await runtime.sendMessage("Hello", {
  context: { source: "browser", timezone: "Europe/Warsaw" },
});
```

## Prompt Composition

Before each message, the runtime syncs dynamic content into the system prompt file (`prompt.md`) via the **prompt composer** (`src/runtime/prompt-sync.ts`).

The composer manages tagged sections in `prompt.md` using HTML comment markers (`<!-- TAG:START -->` / `<!-- TAG:END -->`). Pi auto-reloads the file on change.

### Registered sections

| Tag | Source | Description |
|-----|--------|-------------|
| `CONTEXT` | Dynamic | Current time and request source (browser/telegram/api), rebuilt per-request |
| `MEMORY` | `.agents/memory/MEMORY.md` | Long-term memories from the continuity skill |
| `QUESTIONS` | `.agents/memory/questions.md` | Open questions from past reflections |

File-based sections are included only if the source file exists. Each section supports an optional prefix (italic description injected before the content).

### Adding a new section

In `src/runtime/prompt-sync.ts`:

```ts
// File-based — included if the file exists, removed if it doesn't
composer.addFileSection("NEWTAG", "path/to/file.md", {
  prefix: "What this section is about.",
});

// Dynamic — builder returns content string or null to remove
composer.addDynamicSection("NEWTAG", async () => "content", {
  heading: "## Custom Heading",
  prefix: "Description of what this is.",
});
```

### Architecture

```
prompt-context.ts    — pure function: builds context lines (time, source)
prompt-composer.ts   — generic engine: replaceSection(), PromptComposer class
prompt-sync.ts       — wiring: creates composer, registers all sections, exposes syncPrompt()
agent-runtime.ts     — calls syncPrompt() before each message
```

## Configuration

`AgentRuntime` is configured entirely via environment variables (see `.env.example`). The socket path defaults to `/tmp/lucy-pi.sock` and can be overridden with `PI_BRIDGE_SOCKET`.

| Env var | Default | Description |
|---------|---------|-------------|
| `PI_BRIDGE_SOCKET` | `/tmp/lucy-pi.sock` | Unix socket for bridge ↔ gateway IPC |
| `PI_BRIDGE_PROMPT` | `prompt.md` | System prompt file path (mutated by composer) |

## Responsibility Boundary

- **Owns**: RPC connection to pi-bridge, message/history translation, system prompt composition
- **Delegates**: agent execution to Pi SDK (in pi-bridge process), HTTP transport to gateway

## Operational Constraints

- Requires a running pi-bridge process on `PI_BRIDGE_SOCKET`
- Per-request `modelId` and `thinkingEnabled` are accepted but currently ignored with a warning
- Prompt composer writes to disk before each message — Pi auto-reloads on file change

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
- Prompt composer does one file read + write per `sync()` call

## Read Next

- [pi-bridge](./src/pi-bridge/README.md) — separate process that spawns and manages the Pi SDK
- [gateway/core](../../gateway/core/README.md) — HTTP gateway that wraps this runtime
