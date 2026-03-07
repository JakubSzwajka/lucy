---
prd: extract-agent-runtime-and-gateways
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Extract Agent Runtime

> Summary: Create the `agents-runtime` standalone package with file-based storage, execution loop, and a smoke test proving it works without any gateway or database.

## Task List

- [x] **1. Scaffold `agents-runtime` package** — create directory, package.json, tsconfig, and empty entry point
- [x] **2. Define port interfaces** — create the runtime's dependency contracts (AgentStore, ItemStore, ConfigStore, ModelProvider, IdentityProvider, SessionStore)
- [x] **3. Define runtime types** — runtime-specific types and minimal domain types, independent of the gateway
- [x] **4. Implement file-based AgentStore** — JSON files for agent state `[blocked by: 2, 3]`
- [x] **5. Implement file-based ItemStore** — JSONL append-only files for conversation items `[blocked by: 2, 3]`
- [x] **6. Implement file-based ConfigStore** — JSON files for agent configs and system prompts `[blocked by: 2, 3]`
- [x] **7. Implement file-based SessionStore and IdentityProvider** — JSON files for session metadata and identity documents `[blocked by: 2, 3]`
- [x] **8. Implement default ModelProvider** — OpenRouter model provider as built-in default `[blocked by: 2, 3]`
- [x] **9. Extract message history utilities** — move message reconstruction and sliding window into the runtime `[blocked by: 3]`
- [x] **10. Extract step persistence** — move `persistStepContent` into the runtime, parameterized by `ItemStore` port `[blocked by: 2, 3]`
- [x] **11. Extract environment context service** — move date/time context injection into the runtime `[blocked by: 3]`
- [x] **12. Extract context assembly** — move `prepareChat` and prompt resolution into `AgentRuntime.prepareContext()` `[blocked by: 2, 3, 9, 11]`
- [x] **13. Extract execution loop** — move `runAgent` into `AgentRuntime.run()` with defaulting constructor `[blocked by: 4, 5, 6, 7, 8, 9, 10, 12]`
- [x] **14. Verify runtime standalone** — smoke test proving a conversation round-trip works with file adapters only `[blocked by: 13]`

---

### 1. Scaffold `agents-runtime` package
<!-- status: done -->

Create `agents-runtime/` at repo root with a minimal package setup. The `package.json` should declare `ai` (Vercel AI SDK), `@openrouter/ai-sdk-provider`, and `zod` as dependencies. Use TypeScript with its own `tsconfig.json`. Entry point should export an empty placeholder. No `@/` path alias — runtime uses relative imports only. This package must have zero imports from the Next.js app.

**Files:** `agents-runtime/package.json`, `agents-runtime/tsconfig.json`, `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** `cd agents-runtime && npm install && npx tsc --noEmit` succeeds

---

### 2. Define port interfaces
<!-- status: done -->

Create `agents-runtime/src/ports.ts` with the six port interfaces: `AgentStore`, `ItemStore`, `ConfigStore`, `ModelProvider`, `IdentityProvider`, `SessionStore`. These reference only the runtime's own domain types (defined in task 3). No imports from `@/types` or `src/lib/server/`.

**Files:** `agents-runtime/src/ports.ts`
**Depends on:** 1
**Validates:** `npx tsc --noEmit` passes; zero external imports beyond `ai` SDK

---

### 3. Define runtime types
<!-- status: done -->

Create `agents-runtime/src/types.ts` with the runtime's own type definitions. Extract and adapt from `src/lib/server/chat/types.ts`: `RunOptions`, `RunResult`, `ModelMessage`, `ModelMessageContent`, `ChatContext`. Define the minimal domain types the runtime needs: Agent, Item union (MessageItem, ToolCallItem, ToolResultItem, ReasoningItem), ModelConfig, AgentConfigWithTools, AgentUpdate, ToolCallStatus. Export `RuntimeDeps` bundling all ports. These are the runtime's own types — not re-exports of gateway types.

**Files:** `agents-runtime/src/types.ts`
**Depends on:** 1, 2
**Validates:** Types compile standalone; `RuntimeDeps` references all six ports

---

### 4. Implement file-based AgentStore
<!-- status: done -->

Create `agents-runtime/src/adapters/file-agent-store.ts` implementing `AgentStore`. Stores each agent as a JSON file at `<dataDir>/sessions/<sessionId>/agents/<agentId>.json`. `getById` reads and parses the file (returns null if not found). `update` reads, merges update fields, writes back. The `dataDir` is configurable via constructor (defaults to `.agents-data`).

**Files:** `agents-runtime/src/adapters/file-agent-store.ts`
**Depends on:** 2, 3
**Validates:** Can write an agent JSON, read it back, update fields; file appears at expected path

---

### 5. Implement file-based ItemStore
<!-- status: done -->

Create `agents-runtime/src/adapters/file-item-store.ts` implementing `ItemStore`. Uses JSONL (one JSON object per line) at `<dataDir>/sessions/<sessionId>/items/<agentId>.jsonl`. `getByAgentId` reads all lines. `create`/`createMessage`/`createToolCall`/`createToolResult` append a line with auto-incrementing `sequence` and generated `id`. `updateToolCallStatus` reads the file, finds the matching item, rewrites.

**Files:** `agents-runtime/src/adapters/file-item-store.ts`
**Depends on:** 2, 3
**Validates:** Can append items, read them back in order; JSONL is human-readable; sequences increment

---

### 6. Implement file-based ConfigStore
<!-- status: done -->

Create `agents-runtime/src/adapters/file-config-store.ts` implementing `ConfigStore`. Agent configs at `<dataDir>/config/agents/<configId>.json`, system prompts at `<dataDir>/config/prompts/<promptId>.json`. Read-only lookups — returns null if file doesn't exist.

**Files:** `agents-runtime/src/adapters/file-config-store.ts`
**Depends on:** 2, 3
**Validates:** Can read a pre-written config JSON; returns null for missing files

---

### 7. Implement file-based SessionStore and IdentityProvider
<!-- status: done -->

Create `agents-runtime/src/adapters/file-session-store.ts` (`touch` updates `updatedAt` in `sessions/<sid>/session.json`). Create `agents-runtime/src/adapters/file-identity-provider.ts` (`getActive` reads `identity/<userId>.json`). Create `agents-runtime/src/adapters/index.ts` barrel exporting all adapters and a `createFileAdapters(dataDir?)` factory that returns a complete `RuntimeDeps` object.

**Files:** `agents-runtime/src/adapters/file-session-store.ts`, `agents-runtime/src/adapters/file-identity-provider.ts`, `agents-runtime/src/adapters/index.ts`
**Depends on:** 2, 3
**Validates:** `createFileAdapters()` returns an object satisfying `RuntimeDeps` (minus `models`); all adapters compile

---

### 8. Implement default ModelProvider
<!-- status: done -->

Create `agents-runtime/src/adapters/openrouter-model-provider.ts` implementing `ModelProvider`. Move logic from `src/lib/server/ai/providers.ts` and `src/lib/server/ai/models.ts`. Reads `OPENROUTER_API_KEY` from environment. Include in `createFileAdapters()` as the default `models` port.

**Files:** `agents-runtime/src/adapters/openrouter-model-provider.ts`
**Depends on:** 2, 3
**Validates:** Given `OPENROUTER_API_KEY`, `getModelConfig()` returns a valid config; `getLanguageModel()` returns an AI SDK model

---

### 9. Extract message history utilities
<!-- status: done -->

Move the pure transformation functions from `ChatService` into `agents-runtime/src/messages.ts`: `itemsToModelMessages`, `itemsToFullModelMessages`, `applySlidingWindow`, `stripImageParts`, `prependSystemPrompt`. Stateless functions using the runtime's own Item and ModelMessage types.

**Files:** `agents-runtime/src/messages.ts`, (reference: `src/lib/server/chat/chat.service.ts` lines 460-621)
**Depends on:** 3
**Validates:** Functions compile against runtime types; no gateway imports

---

### 10. Extract step persistence
<!-- status: done -->

Move `persistStepContent` into `agents-runtime/src/step-persistence.ts`. Accept `ItemStore` port as first argument instead of importing `getItemService()`. Content part types (`TextPart`, `ReasoningPart`, `ToolCallPart`, etc.) move into runtime types.

**Files:** `agents-runtime/src/step-persistence.ts`, (reference: `src/lib/server/chat/step-persistence.service.ts`)
**Depends on:** 2, 3
**Validates:** Function compiles with `ItemStore` parameter; no import from `src/`

---

### 11. Extract environment context service
<!-- status: done -->

Move `EnvironmentContextService` into `agents-runtime/src/environment-context.ts`. Pure utility with zero external dependencies — copy as-is.

**Files:** `agents-runtime/src/environment-context.ts`, (reference: `src/lib/server/chat/environment-context.service.ts`)
**Depends on:** 3
**Validates:** Compiles standalone; `buildContext()` returns a string with current date/time

---

### 12. Extract context assembly
<!-- status: done -->

Create context assembly in `agents-runtime/src/runtime.ts` with logic from `ChatService.prepareChat()`, `resolveSystemPrompt()`, `loadAgentWithConfig()`. Loads agent + config via ports, resolves model, composes system prompt, injects environment and identity context. Tools field is empty `{}` (no tool system yet).

**Files:** `agents-runtime/src/runtime.ts`
**Depends on:** 2, 3, 9, 11
**Validates:** Given file adapters with seed data, `prepareContext()` returns a valid context with system prompt, model, and empty tools

---

### 13. Extract execution loop
<!-- status: done -->

Create `AgentRuntime` class in `agents-runtime/src/runtime.ts` with `run()` method. Constructor takes optional `Partial<RuntimeDeps>` — missing ports default to file-based adapters via `createFileAdapters()`. Handles streaming and non-streaming paths, manages abort controllers. Langfuse tracing **removed** — `onFinish` hook in `RunOptions` replaces auto-reflection. Export from `agents-runtime/src/index.ts`.

**Files:** `agents-runtime/src/runtime.ts`, `agents-runtime/src/index.ts`
**Depends on:** 4, 5, 6, 7, 8, 9, 10, 12
**Validates:** `new AgentRuntime()` works with zero args; `run()` compiles; public API exported

---

### 14. Verify runtime standalone
<!-- status: done -->

Write `agents-runtime/scripts/smoke-test.ts` that: creates an `AgentRuntime()` with defaults, seeds config + agent + session via file adapters, calls `runtime.run()` in non-streaming mode, checks items were written to JSONL. Proves the runtime works without Next.js, Postgres, or any gateway. Run with `npx tsx scripts/smoke-test.ts`.

**Files:** `agents-runtime/scripts/smoke-test.ts`
**Depends on:** 13
**Validates:** Script runs successfully; `.agents-data/` populated; agent response printed
