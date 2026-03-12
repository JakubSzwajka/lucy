---
title: Memory Plugin
section: Runtime
subsection: Extensions
order: 10
---

# agents-memory

Pi extension that injects `memory.md` into the system prompt and writes new observations after each completed run.

## Status

Best-effort scaffold. It persists observations and a synthesized memory file, but it is not a full retrieval or ranking system.

## Public API

- default export — Pi extension factory
- `CURSOR_PATH`, `MEMORY_DIR`, `MEMORY_MD_PATH`, `OBSERVATIONS_PATH`
- types for observation and cursor state

## Activation

The runtime loads this package as a Pi extension. On `before_agent_start` it appends `memory.md` to the system prompt; on `agent_end` it runs observation and memory synthesis.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `AGENTS_DATA_DIR` | `~/.agents-data` | Storage root for `memory/` files |
| `MEMORY_OBSERVER_MODEL` | `claude-sonnet-4-20250514` | Model used for extraction/synthesis |
| `MEMORY_MAX_FACTS` | `50` | Max synthesized facts kept in memory |
| `ANTHROPIC_API_KEY` | — | Required to run observation/synthesis |

If `ANTHROPIC_API_KEY` is missing, memory injection still works but observation is skipped.

## Use It Like This

```ts
import memoryExtension from "agents-memory";
```

## Responsibility Boundary

Owns prompt injection plus observation-file maintenance. Delegates agent execution to Pi, and delegates model calls to Anthropic through the AI SDK.

## Operational Constraints

- Reads and writes files under `AGENTS_DATA_DIR`
- Swallows observer failures so chat runs do not fail on memory issues
- Requires completed run messages to build observations; no background backfill

## Read Next

- [agents-runtime](../../core/README.md) - runtime bootstrap and extension host
