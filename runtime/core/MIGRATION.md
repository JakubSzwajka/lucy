# Migration: Pi SDK Harness (v0.2)

## Config Changes

### `agents-runtime.model` (new)

Specifies the default model in `provider/modelId` format.

```json
"agents-runtime": {
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

### `agents-runtime.compaction` (changed)

Old shape (message-count window):
```json
"compaction": { "windowSize": 50 }
```

New shape (token-based):
```json
"compaction": {
  "enabled": true,
  "reserveTokens": 16384,
  "keepRecentTokens": 20000
}
```

- `enabled` — toggle compaction (default: `true`)
- `reserveTokens` — tokens reserved for response generation
- `keepRecentTokens` — recent tokens kept unsummarized

### `agents-runtime.extensions` (new)

Runtime plugins are replaced by Pi extensions. Move runtime plugin entries from `plugins` to `extensions`:

Old:
```json
"plugins": [
  { "package": "agents-memory", "config": { "modelId": "..." } }
]
```

New:
```json
"agents-runtime": {
  "extensions": ["agents-memory"]
},
"plugins": []
```

### `plugins` (changed)

Now gateway-only. Runtime plugins listed here produce a warning and are skipped. Move them to `agents-runtime.extensions`.

### Memory observer config

Memory observer settings moved from plugin config to environment variables:

| Old (plugin config) | New (env var) | Default |
|---------------------|---------------|---------|
| `config.modelId` | `MEMORY_OBSERVER_MODEL` | `claude-sonnet-4-20250514` |
| `config.maxFacts` | `MEMORY_MAX_FACTS` | `50` |

Also requires `ANTHROPIC_API_KEY` env var for the observer's LLM calls.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Anthropic models |
| `OPENAI_API_KEY` | API key for OpenAI models |
| `GOOGLE_API_KEY` | API key for Google models |
| `OPENROUTER_API_KEY` | API key for OpenRouter models |
| `MEMORY_OBSERVER_MODEL` | Model for memory extraction (default: `claude-sonnet-4-20250514`) |
| `MEMORY_MAX_FACTS` | Max facts in memory.md (default: `50`) |
