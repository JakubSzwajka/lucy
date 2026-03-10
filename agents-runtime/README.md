# agents-runtime

Standalone agent runtime wrapping the [Pi SDK](https://github.com/nichochar/pi-agent) (`@mariozechner/pi-coding-agent`). Loads config, sets up a Pi `AgentSession` with persistent sessions, identity enrichment, and extensions.

## Public API

```ts
AgentRuntime          // Main class: init(), sendMessage(), getHistory(), getModels(), abort(), destroy()
resolveDataDir()      // Resolves data dir: AGENTS_DATA_DIR env > ~/.agents-data
loadConfig(path?)     // Loads lucy.config.json into typed LucyConfig
```

Types: `RuntimeConfig`, `SessionConfig`, `CompactionConfig`, `ModelConfig`, `HistoryEntry`, `IdentityContent`, `LucyConfig`, `PluginEntry`, `GatewayHttpConfig`.

## Config (`lucy.config.json`)

```jsonc
{
  "agents-runtime": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "session": { "persist": true, "resume": true },
    "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 },
    "extensions": ["agents-memory"]
  }
}
```

| `persist` | `resume` | Behavior |
|-----------|----------|----------|
| `true` (default) | `true` (default) | Resumes last session from `~/.agents-data/sessions/` |
| `true` | `false` | New session file each boot |
| `false` | — | In-memory only |

## Responsibility Boundary

Owns agent session lifecycle, config loading, and Pi SDK orchestration. Delegates HTTP transport to `agents-gateway-http`, gateway plugin loading to `agents-gateway-http`, and agent behavior extensions to Pi SDK's extension system.

## File Structure

```
src/
├── index.ts                    # Barrel export
├── types.ts                    # Type re-export barrel
├── runtime/agent-runtime.ts    # Pi SDK wrapper + identity + data dir
├── config/load-config.ts       # lucy.config.json loader
├── config/types.ts             # LucyConfig shape
└── types/                      # domain.ts, plugins.ts, runtime.ts
```

## Known Limitations

- **Tools** — always `[]`; tool wiring not yet implemented
- **Per-request model/thinking** — Pi SDK uses session-level config; per-request overrides log a warning
- **compactionSummary** — always `null` in `getHistory()`

## Read Next

- [agents-gateway-http](../agents-gateway-http/README.md) — HTTP gateway that wraps this runtime
- [agents-memory](../agents-memory/README.md) — Pi extension for memory/observation
