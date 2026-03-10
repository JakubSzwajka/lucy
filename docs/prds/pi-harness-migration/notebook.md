# Notebook: Pi Harness Migration

Shared scratchpad for cross-session context. Read before starting any task.

---

### Discovery session — 2026-03-09
- **Found:** Lucy's `agents-runtime` independently converged on the same architecture as Pi's harness — agent loop, context assembly, plugin lifecycle, compaction. The mapping is nearly 1:1.
- **Key insight:** Lucy's port interfaces (`AgentStore`, `ItemStore`, `ModelProvider`, `IdentityProvider`) are more explicit than Pi's. However, Pi's `SessionManager` handles persistence internally, so most ports get absorbed.
- **Replacement estimate:** ~70% of runtime internals delegate to Pi SDK. The remaining ~30% is Lucy's unique value (HTTP gateway, identity, gateway plugins).
- **Self-modification angle:** If the agent will modify its own code, the harness must be external and immutable. Pi as an external dependency satisfies this. Lucy becomes extensions + gateway on top.

### Open questions deep dive — 2026-03-09
- **All 6 original questions resolved.** See `resolved-questions.md` for details.
- **Model bridging is a non-issue.** Both use Vercel AI SDK. But we go further: adopt Pi's full `AuthStorage` + `ModelRegistry` for multi-provider support instead of bridging.
- **Multi-session is a non-issue.** Single-agent-channel PRD already collapsed to one agent per deployment = one Pi session.
- **Session migration is a non-issue.** Start fresh. Memory observer's data is independent of session format.
- **Hot-reload is a must-have.** Essential for self-evolving agent. `resourceLoader.reload()` exists but exact re-init behavior needs verification during implementation.
- **Compaction budgets are configurable.** Expose in `lucy.config.json`, experiment post-migration.
- **Model provider decision:** Adopt Pi's provider system entirely (not just bridge). Drops `OpenRouterModelProvider` and the `ModelProvider` port. Gains 15+ providers out of the box.

### Feasibility review feedback — 2026-03-09
PRD was challenged by another agent. Findings and fixes:
- **P1 (fixed): Memory observer reads items.jsonl directly.** The observer pipeline depends on Lucy's file-based `Item` type. Post-migration, Pi owns session data. Fix: observer uses `event.messages` from `agent_end` event + `ctx.sessionManager.getEntries()` instead of reading files. `transcript.ts` adapted to Pi's `AgentMessage[]`.
- **P2 (fixed): cancelAgent() not mentioned.** Exported but unused by any consumer. Maps to `session.abort()`. Added to replacement table and new AgentRuntime shape.
- **P2 (fixed): Memory plugin uses RuntimeDeps.models.** Post-migration, uses `ctx.modelRegistry.find()` for model access. `agents-memory` keeps `ai` as direct dependency for `generateText()`.
- **P2 (fixed): Three consumer packages not mentioned.** `agents-plugin-whatsapp`, `agents-webui`, `agents-landing-page` import `GatewayPlugin*` types — all preserved. WhatsApp also imports `AgentRuntime` (public API preserved). Added to PRD.
- **P3 (fixed): loadPlugins() removal breaks gateway.** Split into `loadGatewayPlugins()` (retained) + runtime plugin loading (removed, replaced by Pi extensions). Added to PRD.
- **Ambiguity (fixed): sendMessage() return type.** Documented event buffering approach: subscribe before prompt, buffer text_delta, read session.messages after completion.
- **Ambiguity (fixed): getHistory() format.** Documented: walks Pi session branch, maps entries to gateway format, extracts CompactionEntry summaries.
- **Added: lucy.config.json breaking change.** Config schema migration needed for existing deployments.
- **Added: getModels() return shape question.** Pi's model objects may differ from Lucy's `ModelConfig` fields.

### Second feasibility review — 2026-03-09
- **P2 (fixed): run() method not addressed.** Only called internally by `sendMessage()`. Removed from public API. Added to removal list.
- **P2 (fixed): agents-memory implicit `ai` dependency.** `observe.ts` and `synthesize.ts` import from `ai` but it's not in `package.json` — resolved transitively via `agents-runtime`. Prerequisite: add `"ai": "^4.3.0"` to `agents-memory/package.json` before migration.
- **P3 (noted): gateway-plugins/lifecycle.ts imports AgentRuntime.** Low impact — public API preserved. Just awareness.
- **Clarified: ConfigStore + IdentityProvider adapter fate.** `FileConfigStore` and `FileIdentityProvider` survive. `createFileAdapters()` slimmed to only create these two (not agent/item stores). Runtime reads config at boot, passes to Pi via ResourceLoader.
- **Clarified: PluginManifest union shrink.** `RuntimePluginManifest` and `DualPluginManifest` removed. `PluginManifest` becomes alias for `GatewayPluginManifest`. `agents-memory` drops manifest export entirely — Pi discovers extensions by path.
- **Clarified: RuntimeConfig shape.** Currently just `{ compaction?: CompactionConfig }`. Post-migration: `{ model?, compaction?, extensions? }` — holding Pi-compatible settings.
- **Clarified: agents-memory entry point.** Switches from `export const manifest` + `createMemoryPlugin()` to `export default function(pi: ExtensionAPI)`.
- **Added: messages.ts full export list** — `itemsToFullModelMessages` was missing from removal list.

### Task decomposition review — 2026-03-09
Five open questions from task review, all resolved:
1. **agentId post-migration:** Was always hardcoded `"agent"` in `ensureAgent()`. WhatsApp handler doesn't use it. Map to `session.sessionId` or keep as constant. Non-issue.
2. **Streaming dropped:** Intentional. No external consumer uses the streaming `RunResult` variant. Gateway and WhatsApp both call `sendMessage()` (non-streaming). Future streaming via `session.subscribe()` is cleaner.
3. **extensionFactories vs additionalExtensionPaths:** Use both. Config entries starting with `.`/`/` → file paths → `additionalExtensionPaths`. Package names → dynamic import → `extensionFactories`. Added resolution logic to task 4.
4. **GatewayPluginConfig:** Already covered — it's a `GatewayPlugin*` type used by `ResolvedGatewayPlugin`. Preserved.
5. **DefaultResourceLoader instead of custom ResourceLoader:** Yes — use `DefaultResourceLoader` with `systemPromptOverride` + `extensionFactories` + `additionalExtensionPaths`. Gets `reload()`, `getPathMetadata()`, `extendResources()` for free. Task 5 significantly simplified.

### Architecture insight
- `AgentRuntime` constructor maps almost 1:1 to `createAgentSession()`. The deps pattern maps to Pi's options pattern. The refactor is mostly wiring, not reimplementation.
- The gateway layer (`agents-gateway-http`) is completely unaffected. It calls `runtime.sendMessage()` and gets a response. What happens inside is Pi's business.
- `agents-memory` migrates from `RuntimePlugin` to Pi extension. Same logic, different hooks: `onRunComplete` → `pi.on("agent_end")`, `prepareContext` → `pi.on("session_start")`.

### Pipeline execution — Waves 0-2 — 2026-03-09

9/14 tasks done across 3 waves. All delegated to agents in parallel per wave.

**Implementation findings:**
- **`systemPromptOverride` is sync, not async.** Signature is `(base: string | undefined) => string | undefined`. Identity and prompt content must be pre-read before building the closure. Both `agent-runtime.ts` (inlined) and `resource-loader.ts` (helper) handle this correctly.
- **`sendMessage` options ignored for now.** `modelId` and `thinkingEnabled` params are prefixed with `_`. To support per-message model switching, call `session.setModel()` and `session.setThinkingLevel()` before prompting. Low priority — gateway doesn't use it.
- **`@ai-sdk/provider` needed as explicit dep.** `execution.ts` imports `LanguageModelV1ProviderMetadata` from it. Was transitive via `@openrouter/ai-sdk-provider` — removing OpenRouter un-hoisted it. Fixed by adding `@ai-sdk/provider: ^1.1.3`.
- **Duplicate resource loader code.** Task 4 inlined prompt/identity/extension logic directly in `agent-runtime.ts`. Task 5 created `resource-loader.ts` as a clean extracted helper. Both exist; `resource-loader.ts` is not imported. **Next agent should decide:** either wire `agent-runtime.ts` to use the helper, or delete the helper during task 9's module removal.
- **CompactionService still uses message-count windowing internally.** The new token-based fields (`reserveTokens`, `keepRecentTokens`) are exposed as getters but `windowSize` is derived via heuristic (~80 tokens/msg). This is moot once Pi's compaction takes over, but the file still exists until task 9 deletes it.
- **`DATA_DIR` removed from gateway config.** Only consumer was the old `runtime.ts` which no longer needs `createFileAdapters(DATA_DIR)`.

**State for next agent (Wave 3+):**
- `agents-runtime` typechecks clean
- `agents-gateway-http` runtime.ts updated but no typecheck script exists — verify manually or add one
- Files to delete in task 9: `execution.ts`, `compaction.ts`, `context.ts`, `prompt-file.ts`, `messages.ts`, `step-persistence.ts`, `environment-context.ts`, `file-agent-store.ts`, `file-item-store.ts`, `plugins/lifecycle.ts`. Also `@ai-sdk/provider` dep can be removed once `execution.ts` is gone. Same for `ai` dep — verify no remaining imports.
- `index.ts` still exports stale types (`RuntimePlugin*`, `RuntimeDeps`, `ChatContext`, `RunResult`, etc.) and stale value exports (`createFileAdapters`, `OpenRouterModelProvider` already removed). Task 10 cleans all of this.
- `resource-loader.ts` created but unused — cleanup candidate
