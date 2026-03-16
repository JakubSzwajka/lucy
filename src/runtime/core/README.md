---
title: Runtime
section: Runtime
subsection: Core
order: 1
---

# agents-runtime

In-process Pi SDK adapter. Creates an agent session via `@mariozechner/pi-coding-agent`, normalizes Pi SDK events to Lucy's `StreamEvent` types, and exposes the `AgentRuntime` public API.

## Public API

```ts
AgentRuntime   // init(), sendMessage(), sendMessageStreaming(), getHistory(), getModels(), getSessionInfo(), abort(), destroy(), subscribe()
```

Types: `ModelConfig`, `HistoryEntry`, `SessionInfo`, `StreamEvent`.

## Activation

Construct `AgentRuntime`, call `init()`, then send messages. The gateway owns process startup and shutdown.

## Use It Like This

```ts
const runtime = new AgentRuntime();
await runtime.init(); // creates in-process Pi session
const { response } = await runtime.sendMessage("Hello");
```

## Prompt Context

Dynamic system prompt context (time, memory, questions) is handled by a **Pi extension** at `.pi/extensions/prompt-context.ts`. The extension uses `before_agent_start` to append dynamic sections to the system prompt at runtime — no file mutation needed.

The base `PROMPT.md` stays static. The TASKS section is managed separately by the tasks skill (writes markers directly into PROMPT.md).

## Configuration

`AgentRuntime` is configured entirely via environment variables (see `.env.example`). Key variables:

| Env var | Default | Description |
|---------|---------|-------------|
| `PI_MODEL` | *(required)* | Model identifier in `provider/modelId` format |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | Pi SDK data directory (sessions, config) |
| `PI_PROMPT` | `PROMPT.md` | Path to system prompt file |

## Responsibility Boundary

- **Owns**: Pi SDK session lifecycle, event normalization to StreamEvent types
- **Delegates**: agent execution to Pi SDK (in-process), HTTP transport to gateway, prompt context injection to Pi extension

## Context & Compaction

Pi auto-compacts when context nears the model's limit. For Sonnet 4 (200k context), compaction triggers at ~183k tokens (200k - 16k reserve). To check current context size:

```bash
tail -20 .agents/pi/sessions/--app--/*.jsonl | \
  jq -r 'select(.message.role=="assistant") | .message.usage | "\(.input + .cacheRead) tokens in context"' | tail -1
```

Note: `getSessionStats()` returns **cumulative** token totals across the whole session, not current context size. The actual context size is the `input + cacheRead` from the most recent assistant message.

## Known Limitations

- History translation only emits user and assistant messages

## Read Next

- [gateway/core](../../gateway/core/README.md) — HTTP gateway that wraps this runtime
