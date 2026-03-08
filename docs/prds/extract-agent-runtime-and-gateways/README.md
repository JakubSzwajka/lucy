---
status: completed
date: 2026-03-07
author: "Codex"
gh-issue: "https://github.com/JakubSzwajka/lucy/issues/27"
---

# Extract Agent Runtime

## Problem

The current backend is structured as a Next.js application with a large `src/lib/server` tree, but the most important runtime behavior is concentrated inside `chat/`. That module currently mixes transport concerns, execution orchestration, tool loading, memory hooks, persistence coordination, and process-local runtime state. This makes the agent hard to package as a reusable unit that can run behind different interfaces.

The goal is **one reusable brain, many configured deployments** — deploy one runtime with a specific configuration (model, prompt) and do work with it, then deploy another with a different configuration. The execution engine underneath is identical and portable. This is not about horizontal scaling; it's about composability and reuse.

## Proposed Solution

Extract a standalone `agents-runtime` package that owns the execution loop, context assembly, and run lifecycle behind a small command-oriented API. The runtime is a **conversation-only brain**: model in, response out. It does not know about HTTP, SSE, CLI, or any transport.

The runtime is **file-based by default** — it ships with built-in adapters that store agents, items, and config as JSON/JSONL files on disk. No database required. Zero external dependencies beyond the AI SDK. Runnable anywhere: local dev, CI, embedded, or a bare server with a filesystem.

Tool injection, plugins, and capability registration are **deferred** to a future package. For now, the runtime's only interface with the agent is conversation.

## Package Structure

```
agents-runtime/
├── package.json
├── tsconfig.json
├── src/
│   ├── runtime.ts              # AgentRuntime class — execution loop
│   ├── ports.ts                # Port interfaces (what the runtime needs)
│   ├── types.ts                # Runtime-specific types + minimal domain types
│   ├── messages.ts             # Message history reconstruction utilities
│   ├── step-persistence.ts     # AI SDK step output → stored items
│   ├── environment-context.ts  # Date/time context injection
│   ├── adapters/               # Built-in file-based adapters (default)
│   │   ├── file-agent-store.ts
│   │   ├── file-item-store.ts
│   │   ├── file-config-store.ts
│   │   ├── file-session-store.ts
│   │   ├── file-identity-provider.ts
│   │   ├── openrouter-model-provider.ts
│   │   └── index.ts            # createFileAdapters() factory
│   └── index.ts                # Public API
└── scripts/
    └── smoke-test.ts           # Standalone verification script
```

**Hard rule:** This package imports nothing from the Next.js app, gateways, or any other package in the monorepo. It is a leaf dependency.

## What the Runtime Owns

- **Execution loop** — streaming (streamText) and non-streaming (generateText multi-turn loop)
- **Context assembly** — load agent config, resolve model, compose system prompt, enrich with environment/identity context
- **Message history reconstruction** — convert stored items to model messages, sliding window
- **Step persistence** — convert AI SDK step output into storable items
- **Run lifecycle** — start, track turns, finalize (mark agent as waiting/completed/failed)
- **Abort handling** — process-local abort controllers for cancellation (known limitation: single-instance only)
- **File-based storage** — built-in JSON/JSONL adapters for all ports

## What the Runtime Does NOT Own

- Tool registry and tool execution (future `agents-plugins` package)
- MCP server connections
- Memory, planning, delegation capabilities
- Auto-reflection
- Transport (SSE, HTTP, WebSocket)
- Auth, session CRUD, title generation
- Frontend/UI
- Database adapters (consumers bring their own)

## Default Storage Layout

```
.agents-data/                    # configurable root
├── config/
│   ├── agents/
│   │   └── <configId>.json      # agent config + tools
│   └── prompts/
│       └── <promptId>.json      # system prompts
├── sessions/
│   └── <sessionId>/
│       ├── session.json         # session metadata
│       ├── agents/
│       │   └── <agentId>.json   # agent state (status, turnCount, etc.)
│       └── items/
│           └── <agentId>.jsonl  # append-only conversation items
└── identity/
    └── <userId>.json            # identity document
```

- **JSON** for entities read/written as a whole (agent state, config, session metadata)
- **JSONL** for append-only sequences (conversation items) — one line per item, efficient for streaming writes and tail reads

## Public API

```typescript
class AgentRuntime {
  constructor(deps?: Partial<RuntimeDeps>);  // defaults to file-based adapters
  run(agentId: string, userId: string, messages: ModelMessage[], options: RunOptions): Promise<RunResult>;
}

type RunOptions = {
  sessionId: string;
  modelId?: string;
  thinkingEnabled?: boolean;
  onFinish?: () => Promise<void>;
} & (
  | { streaming: true }
  | { streaming: false; maxTurns?: number }
);

type RunResult =
  | { streaming: true; stream: StreamTextResult }
  | { streaming: false; result: string; reachedMaxTurns: boolean };
```

`RuntimeDeps` is optional — missing ports default to file-based adapters. Consumers can override any or all ports.

## Ports (Dependency Injection)

The runtime depends on **interfaces**, not implementations. File-based adapters are the built-in default.

```typescript
interface RuntimeDeps {
  agents: AgentStore;
  items: ItemStore;
  config: ConfigStore;
  models: ModelProvider;
  identity: IdentityProvider;
  sessions: SessionStore;
}
```

| Port | Methods | Default Adapter |
|------|---------|----------------|
| `AgentStore` | `getById`, `update` | JSON files |
| `ItemStore` | `getByAgentId`, `create`, `createMessage`, `createToolCall`, `createToolResult`, `updateToolCallStatus` | JSONL files |
| `ConfigStore` | `getAgentConfig`, `getSystemPrompt` | JSON files |
| `ModelProvider` | `getModelConfig`, `getLanguageModel`, `buildProviderOptions` | OpenRouter |
| `IdentityProvider` | `getActive` | JSON file |
| `SessionStore` | `touch` | JSON file |

## Code to Extract

From `src/lib/server/chat/` (~2,400 lines), the following moves into `agents-runtime`:

| Current Location | Lines | What |
|---|---|---|
| `chat.service.ts` → `runAgent()` | ~220 | Execution loop (streaming + non-streaming) |
| `chat.service.ts` → `prepareChat()` | ~110 | Context assembly |
| `chat.service.ts` → `itemsToModelMessages()` | ~45 | History reconstruction (streaming mode) |
| `chat.service.ts` → `itemsToFullModelMessages()` | ~50 | History reconstruction (non-streaming mode) |
| `chat.service.ts` → `applySlidingWindow()` | ~20 | Context windowing |
| `chat.service.ts` → `resolveSystemPrompt()` | ~12 | Prompt resolution |
| `chat.service.ts` → helpers | ~30 | `stripImageParts`, `prependSystemPrompt` |
| `step-persistence.service.ts` | ~170 | AI SDK → item persistence |
| `environment-context.service.ts` | ~40 | Date/time context injection |
| `types.ts` | ~87 | `ChatContext`, `RunAgentOptions`, `RunAgentResult`, `ModelMessage` |
| `ai/providers.ts` | ~30 | `getLanguageModel`, `buildProviderOptions` |
| `ai/models.ts` | ~45 | `getModelConfig`, `fetchAvailableModels` |

## Key Cases

- Run the runtime standalone with file-based storage — no database, no gateway, just files on disk.
- Instantiate with zero config: `new AgentRuntime()` works out of the box with an API key.
- Override individual ports: `new AgentRuntime({ items: myCustomStore })` replaces only that adapter.
- Deploy multiple runtime instances with different configurations (different models, prompts) sharing the same execution engine.

## Out of Scope

- Gateway integration (see `wire-gateway-to-runtime` PRD).
- Tool injection and plugin system (future PRD).
- CLI gateway implementation (future PRD).
- Persistence schema migration (session/agent/item → thread/run/step/event).
- Multi-instance coordination.
- Monorepo workspace setup (see `wire-gateway-to-runtime` PRD).

## Open Questions

- Should the runtime emit structured events (for streaming progress, step completion) or keep the current AI SDK stream pass-through?
- Should tracing be injected as a port or middleware?
- What file locking strategy (if any) for the JSONL item store in concurrent scenarios?
- How should the runtime handle errors from ports (e.g., model provider fails, item store fails)?

## References

- [Current chat execution engine](../../../src/lib/server/chat/README.md)
- [Current sessions model](../../../src/lib/server/sessions/README.md)
- [ADR 0007: recursive sessions and unified agent execution](../../decisions/0007-adopt-recursive-sessions-and-unified-agent-execution.md)
- [Current data flows](../../data-flows.md)
