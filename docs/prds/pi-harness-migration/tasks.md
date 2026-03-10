---
prd: pi-harness-migration
generated: 2026-03-09
last-updated: 2026-03-09
---

# Tasks: Replace agents-runtime internals with Pi SDK harness

> Summary: Migrate agents-runtime from a custom agent loop, compaction, and plugin system to Pi SDK as the execution harness. 14 tasks ordered by dependency — the first 3 are parallelizable prerequisites, then the core replacement sequence, then consumer updates.

## Task List

- [x] **1. Add Pi SDK dependency to agents-runtime** — install `@mariozechner/pi-coding-agent` and verify it resolves
- [x] **2. Add explicit `ai` dependency to agents-memory** — prevent broken transitive resolution after agents-runtime drops it
- [x] **3. Update `RuntimeConfig` and `LucyConfig` types for Pi settings** — new config shape for model, compaction, extensions
- [x] **4. Rewrite `AgentRuntime` as Pi SDK adapter** — replace constructor, `init()`, `destroy()`, `sendMessage()`, `getHistory()`, `getModels()` `[blocked by: 1, 3]`
- [x] **5. Implement custom `ResourceLoader` for Lucy** — wire prompt.md, identity, environment context into Pi's system prompt `[blocked by: 1]`
- [x] **6. Replace `OpenRouterModelProvider` with Pi `AuthStorage` + `ModelRegistry`** — multi-provider model access `[blocked by: 4]`
- [x] **7. Split `loadPlugins()` into gateway-only loader** — retain gateway plugin loading, remove runtime plugin loading `[blocked by: 3]`
- [x] **8. Slim `createFileAdapters()` to config + identity only** — remove agent/item store creation, keep what extensions need `[blocked by: 4]`
- [x] **9. Remove replaced modules from agents-runtime** — delete execution.ts, compaction.ts, context.ts, messages.ts, step-persistence.ts, prompt-file.ts, environment-context.ts, and unused adapters `[blocked by: 4, 5, 6, 8]`
- [x] **10. Update agents-runtime type exports and public API** — remove RuntimePlugin types, slim PluginManifest, re-export Pi types `[blocked by: 9]`
- [x] **11. Update gateway boot sequence** — use `loadGatewayPlugins()` and new `AgentRuntime` constructor `[blocked by: 4, 7]`
- [x] **12. Rewrite agents-memory as Pi extension** — convert plugin to extension factory, adapt observation pipeline to Pi messages `[blocked by: 4, 10]`
- [x] **13. Verify consumer packages compile** — check agents-plugin-whatsapp, agents-webui, agents-landing-page imports `[blocked by: 10]`
- [x] **14. Update `lucy.config.json` schema and add migration notes** — document breaking config change `[blocked by: 7, 12]`

---

### 1. Add Pi SDK dependency to agents-runtime
<!-- status: done -->

Add `@mariozechner/pi-coding-agent` to `agents-runtime/package.json` dependencies. Run `npm install` at workspace root. Verify the package resolves and key exports are accessible: `createAgentSession`, `SessionManager`, `AuthStorage`, `ModelRegistry`, `SettingsManager`, `DefaultResourceLoader`, `createExtensionRuntime`.

**Files:** `agents-runtime/package.json`, `package.json` (workspace root)
**Depends on:** —
**Validates:** `import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent"` compiles without error.

---

### 2. Add explicit `ai` dependency to agents-memory
<!-- status: done -->

`agents-memory/src/observe.ts:1` and `agents-memory/src/synthesize.ts:1` import `generateText` from `"ai"` but `agents-memory/package.json` doesn't list it — it resolves transitively via `agents-runtime`. When agents-runtime drops `ai`, this breaks. Add `"ai": "^4.3.0"` to `agents-memory/package.json` dependencies now, before the migration.

**Files:** `agents-memory/package.json`
**Depends on:** —
**Validates:** `npm ls ai --workspace=agents-memory` shows `ai` as a direct dependency. `npm run typecheck --workspace=agents-memory` passes.

---

### 3. Update `RuntimeConfig` and `LucyConfig` types for Pi settings
<!-- status: done -->

Change `RuntimeConfig` in `agents-runtime/src/types/plugins.ts` from `{ compaction?: CompactionConfig }` to hold Pi-compatible settings: `model?: string`, `compaction?: { enabled?: boolean; reserveTokens?: number; keepRecentTokens?: number }`, `extensions?: string[]`. Update `LucyConfig` in `agents-runtime/src/config/types.ts` if needed. Update `load-config.ts` KNOWN_KEYS if the shape changes validation.

**Files:** `agents-runtime/src/types/plugins.ts`, `agents-runtime/src/config/types.ts`, `agents-runtime/src/config/load-config.ts`
**Depends on:** —
**Validates:** `npm run typecheck --workspace=agents-runtime` passes. The new `RuntimeConfig` type accepts `{ model: "anthropic/claude-sonnet-4-20250514", compaction: { enabled: true, reserveTokens: 16384 }, extensions: ["agents-memory"] }`.

---

### 4. Rewrite `AgentRuntime` as Pi SDK adapter
<!-- status: done -->

Replace the internals of `agents-runtime/src/runtime/agent-runtime.ts`. The new implementation:

1. Constructor accepts `AgentRuntimeOptions` (updated to include Pi config).
2. `init()` calls `createAgentSession()` with `SessionManager.inMemory()` (or `.create()` with configured dataDir), `SettingsManager.inMemory()` with compaction settings from `RuntimeConfig`, `DefaultResourceLoader` with overrides (task 5), and model from `RuntimeConfig.model` via `ModelRegistry` (task 6). Resolves extensions from `RuntimeConfig.extensions`: entries starting with `.` or `/` go to `additionalExtensionPaths`, package names go through dynamic import and `extensionFactories`.
3. `sendMessage(message, options?)` subscribes to session events, calls `session.prompt(message)`, buffers `text_delta` events, returns `{ response, agentId: session.sessionId, reachedMaxTurns }` by reading final state. (`agentId` was always the static string `"agent"` — `sessionId` is equivalent; no consumer depends on the value.)
4. `getHistory()` reads `session.messages`, maps Pi `AgentMessage[]` to a gateway-compatible format. Extracts compaction summary from session entries if present.
5. `getModels()` delegates to `modelRegistry.getAvailable()`, maps Pi model objects to the `ModelInfo` shape the gateway expects.
6. `abort()` calls `session.abort()`. Remove `cancelAgent()` export and the module-level `activeAbortControllers` Map.
7. `destroy()` calls `session.dispose()`.
8. Remove `run()`, `prepareContext()`, `ensureAgent()` private methods — Pi handles all of this internally.
9. Streaming `RunResult` variant (`{ streaming: true; stream: StreamTextResult }`) is dropped. No external consumer uses it — gateway and WhatsApp both call `sendMessage()` which was already non-streaming. Future streaming via `session.subscribe()` event forwarding is cleaner.

Keep the public API signature compatible so `agents-gateway-http` and `agents-plugin-whatsapp` don't break. The `response` field in `sendMessage()` result must remain a string.

**Files:** `agents-runtime/src/runtime/agent-runtime.ts`
**Depends on:** 1, 3
**Validates:** `npm run typecheck --workspace=agents-runtime` passes. A smoke test calling `runtime.init()` → `runtime.sendMessage("hello")` returns a response string.

---

### 5. Configure `DefaultResourceLoader` for Lucy
<!-- status: done -->

Use Pi's `DefaultResourceLoader` with override hooks instead of implementing `ResourceLoader` from scratch. This replaces `context.ts`, `prompt-file.ts`, and `environment-context.ts`:

1. Create the loader with `systemPromptOverride` that reads `./prompt.md` and appends identity context (from `FileIdentityProvider`). Pi handles environment context (date/time) by default — no need to replicate.
2. Pass `extensionFactories` and `additionalExtensionPaths` resolved from `RuntimeConfig.extensions` (package names vs file paths — see task 4).
3. `getSkills()`, `getPrompts()`, `getThemes()`, `getAgentsFiles()`, `getPathMetadata()`, `extendResources()`, `reload()` all work out of the box from `DefaultResourceLoader`. `reload()` is the hot-reload path — re-reads prompt.md and re-discovers extensions from disk.
4. Set `cwd` and `agentDir` on the loader to control Pi's discovery paths.

This is wiring code inside `AgentRuntime.init()`, not a separate file. If the logic grows, extract to a helper.

**Files:** `agents-runtime/src/runtime/agent-runtime.ts` (loader setup inside `init()`)
**Depends on:** 1
**Validates:** `DefaultResourceLoader` with `systemPromptOverride` returns prompt.md + identity content. `reload()` picks up changes to prompt.md.

---

### 6. Replace `OpenRouterModelProvider` with Pi `AuthStorage` + `ModelRegistry`
<!-- status: done -->

In the rewritten `AgentRuntime.init()`, configure Pi's model system instead of `OpenRouterModelProvider`:

1. Create `AuthStorage.create(authPath)` (path from config or default).
2. Set API keys from environment: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, etc. via `authStorage.setRuntimeApiKey()`.
3. Create `ModelRegistry(authStorage)`.
4. Resolve the configured model via `modelRegistry.find(provider, modelId)` or Pi's `getModel()`.
5. Pass model to `createAgentSession({ model })`.
6. `getModels()` calls `modelRegistry.getAvailable()` and maps to gateway-compatible shape.

Remove `agents-runtime/src/adapters/openrouter-model-provider.ts`. Remove `@openrouter/ai-sdk-provider` from `agents-runtime/package.json`.

**Files:** `agents-runtime/src/runtime/agent-runtime.ts` (model wiring section), `agents-runtime/src/adapters/openrouter-model-provider.ts` (delete), `agents-runtime/package.json`
**Depends on:** 4
**Validates:** `runtime.getModels()` returns models from configured providers. `runtime.sendMessage()` works with an Anthropic or OpenAI model.

---

### 7. Split `loadPlugins()` into gateway-only loader
<!-- status: done -->

Refactor `agents-runtime/src/plugins/loader.ts`. Currently `loadPlugins()` returns `{ gateway, runtime }` by iterating plugin entries and checking manifest type. Split into:

1. `loadGatewayPlugins(entries)` — only loads plugins where `manifest.type === "gateway"` or the gateway half of `"both"`. Returns `ResolvedGatewayPlugin[]`.
2. Remove the runtime plugin loading path entirely — Pi extensions replace it.
3. If a plugin has `type: "runtime"` and is listed in `plugins`, log a warning that it should be moved to `agents-runtime.extensions`.
4. If a plugin has `type: "both"`, load only the gateway half. The runtime half is ignored (it should be migrated to a Pi extension separately).

Update the export from `agents-runtime/src/index.ts`: `loadPlugins` → `loadGatewayPlugins`.

**Files:** `agents-runtime/src/plugins/loader.ts`, `agents-runtime/src/index.ts`
**Depends on:** 3
**Validates:** `loadGatewayPlugins([{ package: "agents-plugin-whatsapp" }])` returns gateway plugins. A `type: "runtime"` entry logs a warning and is skipped.

---

### 8. Slim `createFileAdapters()` to config + identity only
<!-- status: done -->

Update `agents-runtime/src/adapters/index.ts`. Currently creates 4 adapters: `FileAgentStore`, `FileItemStore`, `FileConfigStore`, `FileIdentityProvider`. Post-migration, Pi owns agent/item persistence. Slim to:

1. Remove `FileAgentStore` and `FileItemStore` from the factory.
2. Return only `{ config: FileConfigStore, identity: FileIdentityProvider }`.
3. Update the return type accordingly.
4. The `ResourceLoader` (task 5) uses `FileIdentityProvider` to read identity docs. `FileConfigStore` is used at boot to read agent config.

Don't delete the adapter files yet — that's task 9.

**Files:** `agents-runtime/src/adapters/index.ts`
**Depends on:** 4
**Validates:** `createFileAdapters()` returns `{ config, identity }` only. TypeScript compilation passes.

---

### 9. Remove replaced modules from agents-runtime
<!-- status: done -->

Delete files that Pi SDK replaces. These are no longer imported by the rewritten `AgentRuntime`:

- `agents-runtime/src/runtime/execution.ts`
- `agents-runtime/src/runtime/compaction.ts`
- `agents-runtime/src/runtime/context.ts`
- `agents-runtime/src/runtime/prompt-file.ts`
- `agents-runtime/src/messages.ts`
- `agents-runtime/src/step-persistence.ts`
- `agents-runtime/src/environment-context.ts`
- `agents-runtime/src/adapters/openrouter-model-provider.ts` (if not already deleted in task 6)
- `agents-runtime/src/adapters/file-agent-store.ts`
- `agents-runtime/src/adapters/file-item-store.ts`
- `agents-runtime/src/plugins/lifecycle.ts`

Also remove `ai` and `@openrouter/ai-sdk-provider` from `agents-runtime/package.json` dependencies (if not done in task 6).

**Files:** all listed above (delete), `agents-runtime/package.json`
**Depends on:** 4, 5, 6, 8
**Validates:** `npm run typecheck --workspace=agents-runtime` passes with no references to deleted files. No dead imports.

---

### 10. Update agents-runtime type exports and public API
<!-- status: done -->

Clean up the public surface of `agents-runtime`:

1. **`types/plugins.ts`:** Remove `RuntimePlugin`, `RuntimePluginConfig`, `RuntimePluginInitInput`, `RuntimePluginPrepareContextInput`, `RuntimePluginPrepareContextResult`, `RuntimePluginRunCompleteInput`, `RuntimePluginRunSummary`, `RuntimePluginSystemPromptSection`, `ResolvedRuntimePlugin`, `RuntimePluginManifest`, `DualPluginManifest`. Keep all `GatewayPlugin*` types. Change `PluginManifest` to be `GatewayPluginManifest` (no longer a union). Keep `CompactionConfig` if still used in `RuntimeConfig`, or remove if replaced by Pi's shape.
2. **`types/runtime.ts`:** Remove `ChatContext`, `RunResult`, `RunOptions`, `ModelMessage`. Remove `RuntimeDeps` (or slim to only what's still needed). Keep `AgentRuntimeOptions`.
3. **`types/domain.ts`:** Keep `Agent`, `AgentConfig*`, `ModelConfig`, `IdentityDocument`. Remove `Item`, `MessageItem`, `ToolCallItem`, `ToolResultItem`, `ReasoningItem`, `ItemBase`, `ItemType`, `ToolCallStatus`, `ModelMessage`, `ModelMessageContent` — Pi owns these now.
4. **`ports.ts`:** Remove `AgentStore`, `ItemStore`, `ModelProvider`. Keep `IdentityProvider`, `ConfigStore`.
5. **`index.ts`:** Remove exports for deleted modules (`cancelAgent`, `createFileAdapters` old shape, `OpenRouterModelProvider`, `loadPlugins`). Add `loadGatewayPlugins`. Re-export Pi SDK types that consumers need (e.g., `ExtensionAPI`, `AgentMessage` if used by agents-memory).

**Files:** `agents-runtime/src/types/plugins.ts`, `agents-runtime/src/types/runtime.ts`, `agents-runtime/src/types/domain.ts`, `agents-runtime/src/ports.ts`, `agents-runtime/src/index.ts`
**Depends on:** 9
**Validates:** `npm run typecheck --workspace=agents-runtime` passes. `agents-gateway-http` and `agents-plugin-whatsapp` still compile (they import `AgentRuntime`, `GatewayPlugin*`).

---

### 11. Update gateway boot sequence
<!-- status: done -->

Rewrite `agents-gateway-http/src/runtime.ts` to use the new loader and runtime:

1. Import `loadGatewayPlugins` instead of `loadPlugins`.
2. Call `loadGatewayPlugins(config.plugins)` to get `ResolvedGatewayPlugin[]`.
3. Create `new AgentRuntime({ config: lucyConfig["agents-runtime"] })` — no more `createFileAdapters(DATA_DIR)` or `resolvedPlugins`.
4. `await runtime.init()` boots the Pi session internally.
5. `agents-gateway-http/src/config.ts` may still need `resolveDataDir` for the `DATA_DIR` export — check if anything else uses it. If only the old `createFileAdapters()` call used it, remove or update.

**Files:** `agents-gateway-http/src/runtime.ts`, `agents-gateway-http/src/config.ts`
**Depends on:** 4, 7
**Validates:** `npm run typecheck --workspace=agents-gateway-http` passes. Gateway starts, `POST /chat` returns a response, `GET /models` returns models.

---

### 12. Rewrite agents-memory as Pi extension
<!-- status: done -->

Convert from `RuntimePlugin` to Pi extension factory. This is the most involved migration:

1. **`plugin.ts` → rewrite as extension factory.** Export `default function memoryExtension(pi: ExtensionAPI)`. Register `pi.on("before_agent_start", ...)` to inject `memory.md` into system prompt (replaces `prepareContext`). Register `pi.on("agent_end", ...)` to trigger observation pipeline (replaces `onRunComplete`).
2. **`observe.ts` — change data source.** Currently reads `items.jsonl` via `readFile()` and parses Lucy `Item[]`. Change to accept Pi `AgentMessage[]` as a parameter (passed from the `agent_end` handler's `event.messages`). Remove the file-reading logic and cursor-based offset tracking — the extension receives only new messages per prompt.
3. **`transcript.ts` — adapt to Pi message types.** `formatTranscript()` currently takes `Item[]`. Change to accept Pi's `AgentMessage[]` (with roles `user`, `assistant`, `toolResult`, `bashExecution`). Map each message type to transcript text.
4. **LLM access.** Replace `deps.models.getModelConfig()` + `deps.models.getLanguageModel()` with `ctx.modelRegistry.find(provider, modelId)`. The model ID comes from config (passed via extension configuration or environment variable). `generateText()` from `ai` package still works — Pi's models are Vercel AI SDK compatible.
5. **`index.ts` — update exports.** Remove `manifest: PluginManifest` export. Export the extension factory as default. Keep type exports for observation types.
6. **`synthesize.ts` — no structural change.** Still takes a `LanguageModel` and calls `generateText()`. The model is now resolved from Pi's registry instead of `RuntimeDeps.models`.
7. **`cursor.ts` — simplify or remove.** The file-offset cursor was needed because the observer read raw JSONL. With Pi's `agent_end` delivering messages per prompt, the cursor may reduce to just tracking "last processed timestamp" for idempotency.
8. **`package.json` — update deps.** Add `@mariozechner/pi-coding-agent` (for `ExtensionAPI`, `AgentMessage` types). `ai` already added in task 2. Remove or update `agents-runtime` dependency (may still need it for `resolveDataDir` or config types).

**Files:** `agents-memory/src/plugin.ts`, `agents-memory/src/observe.ts`, `agents-memory/src/transcript.ts`, `agents-memory/src/index.ts`, `agents-memory/src/cursor.ts`, `agents-memory/package.json`
**Depends on:** 4, 10
**Validates:** `npm run typecheck --workspace=agents-memory`. Extension loads in a Pi session via `extensionFactories`. After a prompt, `observations.jsonl` gets new entries and `memory.md` is synthesized. On next prompt, memory content appears in system prompt.

---

### 13. Verify consumer packages compile
<!-- status: done -->

Run typecheck on all packages that import from `agents-runtime` to confirm nothing broke:

1. `npm run typecheck --workspace=agents-plugin-whatsapp` — imports `AgentRuntime`, `GatewayPlugin`, `GatewayPluginInitInput`, `GatewayPluginManifest`. Verify `AgentRuntime` still has `sendMessage()` returning `{ response: string; agentId: string; reachedMaxTurns: boolean }`.
2. `npm run typecheck --workspace=agents-webui` — imports `GatewayPlugin`, `GatewayPluginManifest`.
3. `npm run typecheck --workspace=agents-landing-page` — imports `GatewayPlugin`, `GatewayPluginManifest`.
4. `npm run typecheck --workspace=agents-gateway-http` — full gateway.
5. `npm run typecheck --workspace=agents-memory` — full memory extension.

Fix any import breakage discovered (likely minor — renamed exports, removed types that need re-export from Pi).

**Files:** no changes expected; fix imports in consumer packages if needed
**Depends on:** 10
**Validates:** All 5 workspace typecheck commands pass with zero errors.

---

### 14. Update `lucy.config.json` schema and add migration notes
<!-- status: done -->

Document the breaking config change and provide a migration path:

1. Update the example/default `lucy.config.json` in the repo to the new schema: `agents-runtime.model`, `agents-runtime.compaction` (new shape), `agents-runtime.extensions` (replaces runtime plugins in `plugins`), `plugins` (now gateway-only).
2. Add a `MIGRATION.md` or a section in `agents-runtime/README.md` explaining the config change from old to new shape.
3. Update `load-config.ts` validation if needed — the `KNOWN_KEYS` array and any shape checks.
4. If a script would help, add `scripts/migrate-config.ts` that reads old `lucy.config.json` and writes the new format.

**Files:** `lucy.config.json`, `agents-runtime/README.md` or `MIGRATION.md` (new), `agents-runtime/src/config/load-config.ts`
**Depends on:** 7, 12
**Validates:** A fresh `lucy.config.json` with the new schema boots the gateway without errors. Old config produces a clear error message pointing to migration docs.
