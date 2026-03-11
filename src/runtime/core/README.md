---
title: Runtime
section: Runtime
order: 1
---

# agents-runtime

Standalone agent runtime wrapping the [Pi SDK](https://github.com/badlogic/pi-mono) (`@mariozechner/pi-coding-agent`). Loads config, sets up a Pi `AgentSession` with persistent sessions and extensions. Auth is OpenRouter-only (`OPENROUTER_API_KEY`).

## Public API

```ts
AgentRuntime          // Main class: init(), sendMessage(), getHistory(), getModels(), abort(), destroy()
resolveDataDir()      // Resolves data dir: AGENTS_DATA_DIR env > ~/.agents-data
loadConfig(path?)     // Loads lucy.config.json — throws if file missing
```

Types: `RuntimeConfig`, `SessionConfig`, `CompactionConfig`, `ModelConfig`, `HistoryEntry`, `AgentRuntimeOptions`, `LucyConfig`.

## Config (`lucy.config.json`)

`runtime` and `runtime.model` are required. Missing config file throws at startup.

```jsonc
{
  "runtime": {
    "model": "openrouter/anthropic/claude-sonnet-4",  // required
    "session": { "persist": true, "resume": true },
    "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 },
    "extensions": []
  }
}
```

| `persist` | `resume` | Behavior |
|-----------|----------|----------|
| `true` (default) | `true` (default) | Resumes last session from `<dataDir>/sessions/` |
| `true` | `false` | New session file each boot |
| `false` | — | In-memory only |

## Responsibility Boundary

Owns agent session lifecycle, config loading, and Pi SDK orchestration. Delegates HTTP transport to gateway, and agent behavior extensions to Pi SDK's extension system.

## File Structure

```
src/
├── index.ts                    # Barrel export
├── types.ts                    # Type re-export barrel
├── runtime/agent-runtime.ts    # Pi SDK wrapper + prompt.md + data dir
├── config/load-config.ts       # lucy.config.json loader (throws if missing)
├── config/types.ts             # LucyConfig shape
└── types/                      # domain.ts, plugins.ts, runtime.ts
```

## Known Limitations

- **Tools** — always `[]`; tool wiring not yet implemented
- **Per-request model/thinking** — Pi SDK uses session-level config; per-request overrides log a warning
- **compactionSummary** — always `null` in `getHistory()`

## Read Next

- [gateway/core](../../gateway/core/README.md) — HTTP gateway that wraps this runtime
- [memory extension](../extensions/memory/README.md) — Pi extension for memory/observation
