---
status: draft
date: 2026-03-07
author: "Codex"
gh-issue: "https://github.com/JakubSzwajka/lucy/issues/27"
---

# Extract Agent Runtime and Gateways

## Problem

The current backend is structured as a Next.js application with a large `src/lib/server` tree, but the most important runtime behavior is concentrated inside `chat/`. That module currently mixes transport concerns, execution orchestration, tool loading, memory hooks, persistence coordination, and process-local runtime state. This works for a single deployed web app, but it makes the agent itself hard to package as a reusable unit that can run behind different interfaces such as HTTP, CLI, background workers, or future embedded hosts.

The goal is **one reusable brain, many configured deployments** — deploy one runtime with a specific configuration (model, prompt, tools) and do work with it, then deploy another with a different configuration. The execution engine underneath is identical and portable. This is not about horizontal scaling; it's about composability and reuse.

## Proposed Solution

Extract a standalone `agents-runtime` package that owns the execution loop, context assembly, and run lifecycle behind a small command-oriented API. The runtime is a **conversation-only brain**: model in, response out. It does not know about HTTP, SSE, CLI, or any transport.

The current Next.js application evolves into `agents-gateway-http` — one consumer of the runtime. Future gateways (CLI, workers) are additional consumers. Each gateway imports the runtime as an external dependency; the runtime never imports from any gateway.

Tool injection, plugins, and capability registration are **deferred** to a future package (`agents-plugins` or similar). For now, the runtime's only interface with the agent is conversation.

## Target Repository Structure

```
lucy/
├── agents-runtime/          # The brain — standalone package
│   ├── package.json
│   ├── src/
│   │   ├── runtime.ts       # AgentRuntime class — execution loop
│   │   ├── ports.ts         # Port interfaces (what the runtime needs)
│   │   ├── types.ts         # Runtime-specific types
│   │   └── index.ts         # Public API
│   └── tsconfig.json
│
├── agents-gateway-http/     # Current Next.js app evolves into this
│   ├── package.json         # depends on agents-runtime
│   ├── src/                 # (current src/ migrates here over time)
│   └── tsconfig.json
│
├── agents-gateway-cli/      # Future: terminal-driven interaction
├── agents-plugins/          # Future: tools, memory, planning, delegation
│
├── package.json             # Monorepo root (workspaces)
└── tsconfig.base.json       # Shared TS config
```

### Dependency Direction

```
agents-gateway-http  ─→  agents-runtime  ←─  agents-gateway-cli
                              ↑
                        agents-plugins (future)
```

**Hard rule:** Runtime imports nothing from gateways or the current Next.js app. Gateways import runtime as an external package dependency.

### Monorepo Approach

Sibling directories, each its own package. Managed via npm/pnpm workspaces so packages can depend on each other as external libraries. The runtime is a dependency of the gateway, not a subdirectory of it.

## Runtime Scope (Tracer Bullet)

The runtime is the deployable brain. For the tracer bullet, it owns **conversation only** — no tool system, no plugins, no capabilities.

### What the runtime owns

- **Execution loop** — streaming (streamText) and non-streaming (generateText multi-turn loop)
- **Context assembly** — load agent config, resolve model, compose system prompt, enrich with environment/identity context
- **Message history reconstruction** — convert stored items to model messages, sliding window
- **Step persistence** — convert AI SDK step output into storable items
- **Run lifecycle** — start, track turns, finalize (mark agent as waiting/completed/failed)
- **Abort handling** — process-local abort controllers for cancellation (known limitation: single-instance only)

### What the runtime does NOT own (yet)

- Tool registry and tool execution (deferred to `agents-plugins`)
- MCP server connections
- Memory, planning, delegation capabilities
- Auto-reflection
- Transport (SSE, HTTP, WebSocket)
- Auth, session CRUD, title generation
- Frontend/UI

### Runtime Public API

```typescript
interface AgentRuntime {
  run(agentId: string, userId: string, messages: ModelMessage[], options: RunOptions): Promise<RunResult>;
}

type RunOptions = {
  sessionId: string;
  modelId?: string;
  thinkingEnabled?: boolean;
} & (
  | { streaming: true }
  | { streaming: false; maxTurns?: number }
);

type RunResult =
  | { streaming: true; stream: StreamTextResult }
  | { streaming: false; result: string; reachedMaxTurns: boolean };
```

### Runtime Ports (Dependency Injection)

The runtime depends on **interfaces**, not implementations. Gateways provide concrete adapters at construction time.

```typescript
interface RuntimeDeps {
  agents: AgentStore;      // read/update agent state
  items: ItemStore;        // read/write conversation items
  config: ConfigStore;     // load agent config + system prompts
  models: ModelProvider;   // resolve model config, get language model
  identity: IdentityProvider; // load identity document for prompt enrichment
  sessions: SessionStore;  // touch session timestamp
}
```

Port definitions:

| Port | Methods | Current Implementation |
|------|---------|----------------------|
| `AgentStore` | `getById`, `update` | `AgentService` |
| `ItemStore` | `getByAgentId`, `create`, `createMessage`, `createToolCall`, `createToolResult`, `updateToolCallStatus` | `ItemService` |
| `ConfigStore` | `getAgentConfig`, `getSystemPrompt` | `AgentConfigService` + `SystemPromptService` |
| `ModelProvider` | `getModelConfig`, `getLanguageModel`, `buildProviderOptions` | `ai/models.ts` + `ai/providers.ts` |
| `IdentityProvider` | `getActive` | `IdentityService` |
| `SessionStore` | `touch` | `SessionService` |

## Migration Path

### Phase 1: Extract runtime package (tracer bullet)

Create `agents-runtime/` as a standalone package. Move the core execution logic from `src/lib/server/chat/chat.service.ts` into the runtime:

- `runAgent()` → `AgentRuntime.run()`
- `prepareChat()` → internal context assembly
- `itemsToModelMessages()` / `itemsToFullModelMessages()` → message history utils
- `applySlidingWindow()` → context windowing
- `persistStepContent()` → step persistence (accepts `ItemStore` port)
- `resolveSystemPrompt()` → prompt resolution
- Environment/identity enrichment

The current `ChatService` becomes a **thin adapter** that:
1. Creates an `AgentRuntime` with Postgres-backed port implementations
2. Delegates `runAgent()` calls to the runtime
3. Keeps gateway-specific logic (`executeTurn`, user message persistence, title generation)

**Zero behavior change.** Same product, same API, but the boundary exists.

### Phase 2: Monorepo setup

- Add workspace configuration to root `package.json`
- Set up `tsconfig.base.json` for shared compiler options
- Make `agents-gateway-http` depend on `agents-runtime` as a workspace package
- Current `src/` continues working but imports runtime from the package

### Phase 3: Tool injection system (future — separate PRD)

- Design `agents-plugins` package for tool registration, MCP integration, builtin capabilities
- Runtime accepts tools through a port/plugin interface
- Memory, planning, delegation become installable plugins

### Phase 4: Gateway split (future — separate PRD)

- Current Next.js app splits into frontend + HTTP gateway
- `agents-gateway-cli` created as a second runtime consumer
- `agents-gateway-worker` for triggers, reflection, background jobs

## Current Code Mapping

Based on analysis of `src/lib/server/chat/` (~2,400 lines):

### Moves to `agents-runtime/`

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

### Stays in gateway (`src/lib/server/chat/`)

| Current Location | What | Why |
|---|---|---|
| `chat.service.ts` → `executeTurn()` | HTTP entry point | Gateway concern: validates session, persists user msg, calls runtime, returns SSE |
| `chat.service.ts` → `persistUserMessage()` | User message persistence | Gateway concern: writes user input before runtime runs |
| `chat.service.ts` → `touchSession()` | Session timestamp | Gateway concern |
| `chat.service.ts` → `resolveToolsForAgent()` | Tool listing for UI | Gateway concern |

### Deferred (future plugins package)

| Current Location | Lines | What |
|---|---|---|
| `tools/registry.ts` | 355 | Tool dispatch and AI SDK conversion |
| `tools/mcp-provider.ts` | 135 | MCP server connections |
| `tools/builtin-provider.ts` | 54 | Builtin tool discovery |
| `tools/builtin/continuity.ts` | 308 | Memory capability |
| `tools/builtin/plan.ts` | 215 | Planning capability |
| `tools/builtin/delegate.ts` | 108 | Sub-agent delegation |
| `tools/types.ts` | 138 | Tool type definitions |

### Process-Local State (known limitations)

| State | Location | Impact |
|---|---|---|
| `activeAbortControllers` | `chat.service.ts` | Cancellation only works within same process |
| `reflecting` Set | `memory/auto-reflection.service.ts` | Reflection mutex is process-local |
| `McpClientPool` | `mcp/pool.ts` | Live TCP/stdio connections, inherently process-bound |

These are acknowledged single-instance limitations. Not addressed in this PRD.

## Non-Chat Modules — Extraction Strategy

| Module | Strategy | Notes |
|---|---|---|
| `db/` | Shared | Both runtime and gateway need same schema |
| `auth/` | Gateway only | Runtime trusts caller identity |
| `ai/` | Port (`ModelProvider`) | Runtime gets model through interface |
| `config/` | Port (`ConfigStore`) | Runtime gets config through interface |
| `mcp/` | Future plugins | Deferred with tool system |
| `sessions/` | Port (`AgentStore`, `ItemStore`, `SessionStore`) | Runtime reads/writes through interfaces |
| `plans/` | Future plugins | Deferred with capabilities |
| `memory/` | Future plugins | Deferred with capabilities |
| `triggers/` | Future gateway (`worker-gateway`) | Entry point concern |
| `openapi/` | Gateway only | API metadata |

## Key Cases

- Run the same runtime behind an HTTP gateway and a CLI gateway without duplicating execution logic.
- Deploy the runtime with different persistence adapters (Postgres, file-based, in-memory for tests).
- Deploy multiple runtime instances with different configurations (different models, prompts) sharing the same execution engine.
- The gateway-http preserves current product behavior during and after migration.

## Out of Scope

- Tool injection and plugin system (separate PRD).
- Rebuilding the frontend UX.
- CLI gateway implementation (separate PRD).
- Replacing the persistence schema (session/agent/item → thread/run/step/event).
- Multi-instance coordination (cancellation, reflection locking).
- Security, tenancy, and observability concerns.

## Open Questions

- Should the runtime emit structured events (for streaming progress, step completion) or keep the current AI SDK stream pass-through?
- What's the right package manager for the monorepo (npm workspaces vs pnpm)?
- Should tracing (Langfuse) live in the runtime or be injected as a port?
- How should the runtime handle errors from ports (e.g., model provider fails, item store fails)?

## References

- [Current source layering](../../../src/README.md)
- [Current chat execution engine](../../../src/lib/server/chat/README.md)
- [Current sessions model](../../../src/lib/server/sessions/README.md)
- [Current memory module](../../../src/lib/server/memory/README.md)
- [ADR 0007: recursive sessions and unified agent execution](../../decisions/0007-adopt-recursive-sessions-and-unified-agent-execution.md)
- [ADR 0005: agent-driven memory reflection](../../decisions/0005-agent-driven-memory-reflection.md)
- [Current data flows](../../data-flows.md)
