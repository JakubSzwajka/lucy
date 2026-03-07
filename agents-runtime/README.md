# agents-runtime

Standalone AI agent execution engine using the Vercel AI SDK. Runs agents in streaming or non-streaming mode with pluggable storage, model providers, and identity enrichment.

## Public API

- `AgentRuntime` — main class; `prepareContext()` builds chat context, `run()` executes an agent turn
- `cancelAgent(agentId)` — aborts a running non-streaming agent
- `resolveDataDir(dataDir?)` — resolves data directory: explicit arg > `AGENTS_DATA_DIR` env var > `~/.agents-data`
- `createFileAdapters(dataDir?)` — creates file-based implementations of all port interfaces (uses `resolveDataDir` internally)
- `OpenRouterModelProvider` — `ModelProvider` implementation using the OpenRouter API

### Port Interfaces (implement to bring your own storage)

- `AgentStore` — read/update agent state
- `ItemStore` — read/append conversation items (messages, tool calls, results, reasoning)
- `ConfigStore` — read agent configs and system prompts
- `ModelProvider` — resolve model IDs to AI SDK `LanguageModel` instances
- `IdentityProvider` — supply identity documents for context enrichment
- `SessionStore` — session lifecycle (touch)

### Types

`Agent`, `Item`, `ModelMessage`, `ChatContext`, `RunOptions`, `RunResult`, `RuntimeDeps`, `AgentConfig`, `AgentConfigWithTools`, `ModelConfig`, `SystemPrompt`, `IdentityDocument`, and related union/item types.

## Use It Like This

```ts
import { AgentRuntime, createFileAdapters } from "agents-runtime";

const runtime = new AgentRuntime(); // uses file adapters + OpenRouter by default

const result = await runtime.run("agent-1", "user-1", messages, {
  sessionId: "session-1",
  streaming: false,
  maxTurns: 5,
});
```

## Responsibility Boundary

Owns agent execution loop (context preparation, model calls, step persistence, cancellation). Delegates storage to port implementations and model resolution to `ModelProvider`. Does **not** own tool registration — tools are passed via `ChatContext`.

## Read Next

- [Adapters](./src/adapters/README.md) — file-based port implementations and OpenRouter provider
