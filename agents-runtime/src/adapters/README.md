# adapters

File-based implementations of the runtime port interfaces, plus an OpenRouter model provider. Used as defaults when no custom adapters are supplied.

## Public API

- `createFileAdapters(dataDir?)` — factory returning all file-based stores (`agents`, `items`, `config`, `sessions`, `identity`)
- `FileAgentStore` — JSON-file `AgentStore`
- `FileItemStore` — JSONL-file `ItemStore`
- `FileConfigStore` — JSON-file `ConfigStore`
- `FileSessionStore` — JSON-file `SessionStore`
- `FileIdentityProvider` — JSON-file `IdentityProvider`
- `OpenRouterModelProvider` — `ModelProvider` using the OpenRouter API (`OPENROUTER_API_KEY` env)

## Responsibility Boundary

Owns file-system persistence and OpenRouter model resolution. Does not own the execution loop or context preparation — that belongs to `AgentRuntime`.

## Read Next

- [Parent: agents-runtime](../../README.md)
