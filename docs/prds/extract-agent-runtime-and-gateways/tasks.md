---
prd: extract-agent-runtime-and-gateways
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Extract Agent Runtime and Gateways

> Summary: Extract the agent execution engine from the Next.js app into a standalone `agents-runtime` package at the repo root. The current app becomes the first gateway consumer. Conversation-only scope — no tools or plugins.

## Task List

- [ ] **1. Scaffold `agents-runtime` package** — create directory, package.json, tsconfig, and empty entry point
- [ ] **2. Set up monorepo workspaces** — configure root package.json for workspace resolution between packages
- [ ] **3. Define port interfaces** — create the runtime's dependency contracts (AgentStore, ItemStore, ConfigStore, ModelProvider, IdentityProvider, SessionStore)
- [ ] **4. Define runtime types** — extract runtime-specific types (RunOptions, RunResult, ModelMessage, ChatContext) into the runtime package
- [ ] **5. Extract message history utilities** — move `itemsToModelMessages`, `itemsToFullModelMessages`, `applySlidingWindow`, `stripImageParts`, `prependSystemPrompt` into the runtime
- [ ] **6. Extract step persistence** — move `persistStepContent` into the runtime, parameterized by `ItemStore` port instead of importing `getItemService()` `[blocked by: 3, 4]`
- [ ] **7. Extract environment context service** — move `EnvironmentContextService` into the runtime as a pure utility `[blocked by: 4]`
- [ ] **8. Extract context assembly** — move `prepareChat`, `resolveSystemPrompt`, `loadAgentWithConfig`, `buildToolFilter` into the runtime as `AgentRuntime.prepareContext()` `[blocked by: 3, 4, 5, 7]`
- [ ] **9. Extract execution loop** — move `runAgent` (streaming + non-streaming paths) into `AgentRuntime.run()` `[blocked by: 3, 4, 5, 6, 8]`
- [ ] **10. Create Postgres-backed port adapters in the gateway** — wrap existing services (AgentService, ItemService, etc.) to implement runtime port interfaces `[blocked by: 3]`
- [ ] **11. Rewire ChatService as gateway adapter** — make ChatService construct AgentRuntime with Postgres adapters and delegate `runAgent()` calls to it `[blocked by: 9, 10]`
- [ ] **12. Verify zero behavior change** — run the app, confirm chat works end-to-end with the new runtime boundary in place `[blocked by: 11]`

---

### 1. Scaffold `agents-runtime` package
<!-- status: pending -->

Create `agents-runtime/` at repo root with a minimal package setup. The package.json should declare `ai` (Vercel AI SDK) and `zod` as dependencies since the runtime uses `streamText`, `generateText`, and Zod schemas. Use TypeScript with its own `tsconfig.json` that extends a shared base. Entry point should export an empty placeholder.

**Files:** `agents-runtime/package.json`, `agents-runtime/tsconfig.json`, `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** `cd agents-runtime && npm install && npx tsc --noEmit` succeeds

---

### 2. Set up monorepo workspaces
<!-- status: pending -->

Add `"workspaces"` field to the root `package.json` listing `agents-runtime` (and the current app root). Create a `tsconfig.base.json` at repo root with shared compiler options. Update `agents-runtime/tsconfig.json` to extend the base. The current app's `tsconfig.json` should also extend the base but keep its Next.js-specific settings. After this, `npm install` at root should link workspace packages.

**Files:** `package.json`, `tsconfig.base.json`, `agents-runtime/tsconfig.json`, `tsconfig.json`
**Depends on:** 1
**Validates:** `npm install` at root resolves workspaces; `agents-runtime` can be imported from the main app via package name

---

### 3. Define port interfaces
<!-- status: pending -->

Create `agents-runtime/src/ports.ts` with the six port interfaces the runtime depends on: `AgentStore`, `ItemStore`, `ConfigStore`, `ModelProvider`, `IdentityProvider`, `SessionStore`. These must use only types defined within the runtime package or from `ai` SDK — no imports from `@/types` or `src/lib/server/`. This means duplicating or re-defining the minimal type surface (Agent, Item, AgentUpdate, ModelConfig, etc.) that ports need.

**Files:** `agents-runtime/src/ports.ts`
**Depends on:** 1
**Validates:** `npx tsc --noEmit` in `agents-runtime` passes; no import from `src/` or `@/`

---

### 4. Define runtime types
<!-- status: pending -->

Create `agents-runtime/src/types.ts` with the runtime's own type definitions. Extract and adapt from the current `src/lib/server/chat/types.ts`: `RunOptions`, `RunResult`, `ModelMessage`, `ModelMessageContent`, `ChatContext`. Also define the minimal domain types the runtime needs (Agent shape, Item shape, ModelConfig shape, AgentConfigWithTools shape) — these are the "runtime view" of domain objects, independent of the gateway's full type definitions. Export a `RuntimeDeps` interface bundling all ports.

**Files:** `agents-runtime/src/types.ts`
**Depends on:** 1, 3
**Validates:** Types compile with no `@/` imports; `RuntimeDeps` references all six ports

---

### 5. Extract message history utilities
<!-- status: pending -->

Move the pure transformation functions from `ChatService` into `agents-runtime/src/messages.ts`: `itemsToModelMessages`, `itemsToFullModelMessages`, `applySlidingWindow`, `stripImageParts`, `prependSystemPrompt`. These are stateless functions that convert stored items into model-ready message arrays. They should use the runtime's own Item and ModelMessage types. Currently these are private methods on ChatService — extract them as standalone exported functions.

**Files:** `agents-runtime/src/messages.ts`, (reference: `src/lib/server/chat/chat.service.ts` lines 460-621)
**Depends on:** 4
**Validates:** Functions compile against runtime types; no dependency on ChatService or gateway imports

---

### 6. Extract step persistence
<!-- status: pending -->

Move `persistStepContent` from `src/lib/server/chat/step-persistence.service.ts` into `agents-runtime/src/step-persistence.ts`. Change the function signature to accept an `ItemStore` port as its first argument instead of calling `getItemService()` internally. The helper functions (`insertItem`, `saveToolCall`, `saveToolResult`, `updateToolCallStatus`) become closures or inline calls on the passed-in `ItemStore`. The content part types (`TextPart`, `ReasoningPart`, `ToolCallPart`, etc.) move into the runtime's types.

**Files:** `agents-runtime/src/step-persistence.ts`, (reference: `src/lib/server/chat/step-persistence.service.ts`)
**Depends on:** 3, 4
**Validates:** Function compiles with `ItemStore` parameter; no import from `src/lib/server/sessions`

---

### 7. Extract environment context service
<!-- status: pending -->

Move `EnvironmentContextService` from `src/lib/server/chat/environment-context.service.ts` into `agents-runtime/src/environment-context.ts`. This is a pure utility (generates date/time context string) with zero external dependencies. Copy as-is.

**Files:** `agents-runtime/src/environment-context.ts`, (reference: `src/lib/server/chat/environment-context.service.ts`)
**Depends on:** 4
**Validates:** Compiles standalone; `buildContext()` returns a string with current date/time

---

### 8. Extract context assembly
<!-- status: pending -->

Create `agents-runtime/src/context.ts` (or integrate into `runtime.ts`) containing the logic currently in `ChatService.prepareChat()`, `resolveSystemPrompt()`, `loadAgentWithConfig()`, and `buildToolFilter()`. This assembles the full execution context: loads agent + config via `ConfigStore` port, resolves model via `ModelProvider` port, composes system prompt, injects environment context and identity document. For the tracer bullet (no tools), the `tools` field in the returned context should be an empty object `{}`. The `buildToolFilter` logic moves here but is effectively a no-op until the plugin system is added.

**Files:** `agents-runtime/src/context.ts` or `agents-runtime/src/runtime.ts`
**Depends on:** 3, 4, 5, 7
**Validates:** Given mock port implementations, `prepareContext()` returns a valid `ChatContext` with system prompt, model, and empty tools

---

### 9. Extract execution loop
<!-- status: pending -->

Create the `AgentRuntime` class in `agents-runtime/src/runtime.ts` with a `run()` method that contains the logic from `ChatService.runAgent()`. The class takes `RuntimeDeps` in its constructor. The `run()` method handles both streaming (`streamText`) and non-streaming (`generateText` multi-turn loop) paths, calls `prepareContext()` for setup, uses `ItemStore` for persistence, and manages abort controllers. Tracing (Langfuse) calls should be **removed** from the runtime — they'll be re-added as a port or middleware later. The `onFinish` callback for auto-reflection should be replaced with an optional `onFinish` hook in `RunOptions` that the gateway can use.

**Files:** `agents-runtime/src/runtime.ts`, `agents-runtime/src/index.ts`
**Depends on:** 3, 4, 5, 6, 8
**Validates:** `AgentRuntime` class compiles; `run()` accepts `RunOptions` and returns `RunResult`; public API exported from `index.ts`

---

### 10. Create Postgres-backed port adapters in the gateway
<!-- status: pending -->

Create `src/lib/server/chat/runtime-adapters.ts` (or similar) that wraps the existing singleton services into runtime port implementations. Each adapter is a thin object literal or class that delegates to the corresponding service: `getAgentService()` → `AgentStore`, `getItemService()` → `ItemStore`, `getAgentConfigService()` + `getSystemPromptService()` → `ConfigStore`, model functions → `ModelProvider`, `getIdentityService()` → `IdentityProvider`, `getSessionService()` → `SessionStore`. This is pure wiring — no logic changes.

**Files:** `src/lib/server/chat/runtime-adapters.ts`
**Depends on:** 3
**Validates:** Each adapter object satisfies its corresponding port interface (TypeScript compiles)

---

### 11. Rewire ChatService as gateway adapter
<!-- status: pending -->

Modify `ChatService` so its `runAgent()` method constructs an `AgentRuntime` (using adapters from task 10) and delegates to `runtime.run()`. Remove the moved code (execution loop, context assembly, message history, step persistence, environment context) from `chat.service.ts`. Keep `executeTurn()`, `persistUserMessage()`, `touchSession()`, `resolveToolsForAgent()` — these are gateway concerns. The `cancelAgent()` function stays in the gateway for now. Update `src/lib/server/chat/index.ts` exports if needed. Remove `step-persistence.service.ts` and `environment-context.service.ts` from the gateway (they now live in the runtime).

**Files:** `src/lib/server/chat/chat.service.ts`, `src/lib/server/chat/index.ts`
**Depends on:** 9, 10
**Validates:** `ChatService.runAgent()` delegates to `AgentRuntime.run()`; removed files no longer exist in `src/lib/server/chat/`

---

### 12. Verify zero behavior change
<!-- status: pending -->

Run `npm run build` to confirm the full app compiles. Start the dev server (`npm run dev`) and verify that chat works end-to-end: send a message, receive a streamed response, confirm items are persisted to the database. Check that delegation (non-streaming sub-agent execution) still works if the tool system is wired through the gateway. This is a manual smoke test — the boundary is invisible to the user.

**Files:** —
**Depends on:** 11
**Validates:** `npm run build` succeeds; chat streaming works in browser; messages persist in DB; no console errors
