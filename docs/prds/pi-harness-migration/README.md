---
status: draft
date: 2026-03-09
author: "kuba"
gh-issue: ""
---

# Replace agents-runtime internals with Pi SDK harness

## Problem

Lucy's `agents-runtime` implements its own agent loop, session management, context assembly, compaction, model resolution, message reconstruction, and step persistence — all generic harness concerns that Pi's SDK handles as a mature framework. Maintaining a custom runtime means:

- **Compaction is naive.** `CompactionService` triggers on user message count (default: 50). Token-based triggering is more accurate. Summaries are unstructured prose.
- **Sessions are flat.** Append-only item sequence — no branching, labeling, or rewinding.
- **Limited hook surface.** Only `prepareContext` and `onRunComplete`. No mid-run interception, no pre-compaction customization, no tool-call gating.
- **Self-modification is blocked.** If the agent eventually modifies its own code, the execution loop must be external and immutable.
- **Duplicated effort.** Streaming, abort, tool execution, step persistence — all maintained in-house.
- **Single model provider.** Only `OpenRouterModelProvider`. Pi ships 15+ providers with OAuth and API key management.

## Background: Current Architecture

### agents-runtime (what changes)

Public API: `AgentRuntime` with `sendMessage()`, `getHistory()`, `getModels()`, `run()`, `init()`, `destroy()`. Also exports `cancelAgent()` (module-level AbortController map — unused by any consumer). `run()` is a lower-level execution method (takes agentId, userId, messages, RunOptions); only called internally by `sendMessage()`. Both `run()` and `cancelAgent()` are removed post-migration.

Internal modules being replaced:
- `execution.ts` — `runStreamingAgent()` / `runNonStreamingAgent()` (Vercel AI SDK `streamText`/`generateText`)
- `context.ts` — `prepareRuntimeContext()` (model resolution, system prompt, identity, environment, plugins)
- `messages.ts` — `itemsToModelMessages()`, `applySlidingWindow()`
- `step-persistence.ts` — AI SDK step output → stored items
- `compaction.ts` — `CompactionService` (message-count trigger, sidecar `compaction.json`)
- `prompt-file.ts` — reads `./prompt.md`
- `environment-context.ts` — date/time injection
- `adapters/openrouter-model-provider.ts` — model resolution

Port interfaces (`ports.ts`): `AgentStore`, `ItemStore`, `ConfigStore`, `ModelProvider`, `IdentityProvider`. File-based adapters for all five in `adapters/` (`FileAgentStore`, `FileItemStore`, `FileConfigStore`, `FileIdentityProvider`, `OpenRouterModelProvider`), assembled via `createFileAdapters()`.

Plugin system: `RuntimePlugin` (`onInit`, `onDestroy`, `prepareContext`, `onRunComplete`), `GatewayPlugin`, `PluginManifest` (union of `RuntimePluginManifest | GatewayPluginManifest | DualPluginManifest`). Loaded via dynamic import from `lucy.config.json`. `agents-memory` exports `manifest: PluginManifest` (resolves to `RuntimePluginManifest` via `type: "runtime"`).

### agents-gateway-http (minimal changes)

Thin Hono HTTP server. Routes: `POST /chat`, `GET /chat/history`, `GET /models`, `GET /health`. Boots via `initRuntime()` in `runtime.ts` which calls `loadConfig()` and `loadPlugins()` from agents-runtime.

### agents-memory (migrates from RuntimePlugin to Pi extension)

`prepareContext` reads `memory.md` → system prompt section. `onRunComplete` triggers observation pipeline: reads `items.jsonl` directly via `readFile()`, formats transcript, calls `generateText()` with a `LanguageModel` obtained from `RuntimeDeps.models`, extracts observations → `observations.jsonl`, synthesizes `memory.md`.

**Critical detail:** The observer reads `items.jsonl` from the file-based `ItemStore` and depends on Lucy's `Item` type shape. It also uses `deps.models.getModelConfig()` + `deps.models.getLanguageModel()` for LLM calls.

### Consumer packages (type-only changes)

Three additional packages import from `agents-runtime`:
- `agents-plugin-whatsapp` — imports `AgentRuntime`, `GatewayPlugin`, `GatewayPluginInitInput`, `GatewayPluginManifest`
- `agents-webui` — imports `GatewayPlugin`, `GatewayPluginManifest`
- `agents-landing-page` — imports `GatewayPlugin`, `GatewayPluginManifest`

All three use only **gateway types** (not `RuntimePlugin`). These types survive the migration.

### Design constraint: single-agent-channel

One agent per deployment, one conversation thread. Maps directly to Pi's model: one `AgentSession` per process.

## Proposed Solution

Replace ~70% of `agents-runtime` internals with Pi SDK. The runtime becomes a thin adapter configuring a Pi `AgentSession` and exposing the same public API.

### What Pi SDK replaces

| Current Lucy code | Pi SDK equivalent |
|---|---|
| `execution.ts` — agent loop | `session.prompt()` with event subscription |
| `messages.ts` — history reconstruction | `SessionManager.buildSessionContext()` |
| `step-persistence.ts` | Pi session entries (automatic) |
| `compaction.ts` | Pi auto-compaction (token-based, structured summaries) |
| `context.ts` — context assembly | `ResourceLoader` + Pi extensions |
| `prompt-file.ts` | `ResourceLoader.getSystemPrompt()` |
| `environment-context.ts` | Pi injects date/time by default |
| `OpenRouterModelProvider` | Pi `AuthStorage` + `ModelRegistry` (15+ providers) |
| `RuntimePlugin` hooks | Pi extension events (`agent_end`, `session_start`, etc.) |
| `RuntimePlugin` loader | Pi extension discovery + `extensionFactories` |
| `cancelAgent()` | `session.abort()` |

### What Lucy keeps

- `agents-gateway-http` — Pi has no HTTP surface
- `GatewayPlugin` system — HTTP route registration, different surface than Pi extensions
- `GatewayPluginManifest`, `GatewayPluginInitInput` — exported types consumed by WhatsApp, WebUI, landing page plugins
- `IdentityProvider` port + `FileIdentityProvider` adapter — becomes a Pi extension for context injection. Adapter stays for reading identity files from disk.
- `ConfigStore` port + `FileConfigStore` adapter — agent config management. Adapter stays; runtime reads config at boot and passes to Pi as `ResourceLoader` overrides.
- `loadConfig()` — reads `lucy.config.json` (still needed for gateway config and extension list)
- `createFileAdapters()` — **slimmed**, only creates `FileConfigStore` + `FileIdentityProvider` (not agent/item stores, which Pi owns)
- **Gateway plugin loader** — `loadPlugins()` splits: `loadGatewayPlugins()` retained (loads only `GatewayPlugin` instances), runtime plugin loading removed (replaced by Pi extension discovery)

### New AgentRuntime shape

```typescript
class AgentRuntime {
  private session: AgentSession;

  async init(): Promise<void> {
    // createAgentSession() with Pi SDK options
  }

  async sendMessage(message: string, options?): Promise<{
    response: string;
    agentId: string;
    reachedMaxTurns: boolean;
  }> {
    // Buffer response via session.subscribe() event listener
    // session.prompt(message)
    // Return buffered response text + metadata
  }

  async getHistory(): Promise<{
    items: HistoryEntry[];  // mapped from Pi session entries
    compactionSummary: string | null;
  }> {
    // session.messages → mapped to gateway-compatible format
    // CompactionEntry summary extracted from session entries
  }

  async getModels(): Promise<ModelInfo[]> {
    // modelRegistry.getAvailable()
    // Map Pi model objects to Lucy's model info shape
  }

  abort(): void {
    // session.abort() — replaces cancelAgent()
  }

  async destroy(): Promise<void> {
    // session.dispose()
  }
}
```

**`sendMessage()` response reconstruction:** Pi's `session.prompt()` returns `Promise<void>`. The implementation subscribes to events before calling prompt, buffers `text_delta` chunks, and reads the final response from `session.messages` after prompt completes. The `reachedMaxTurns` flag is determined by the stop reason from the last `agent_end` event.

**`getHistory()` format:** Pi stores entries in a tree, not flat items. The method walks the current branch via `sessionManager.getBranch()`, maps session entries to a gateway-compatible format. `CompactionEntry` summaries are extracted from the branch. The exact return shape may change — gateway consumers should be updated if needed.

### Plugin-to-extension migration

| Lucy RuntimePlugin hook | Pi extension equivalent |
|---|---|
| `prepareContext(agent, modelConfig, ...)` | `pi.on("before_agent_start", ...)` — can inject messages and modify system prompt |
| `onRunComplete(agent, run)` | `pi.on("agent_end", ...)` — receives `event.messages` for the completed prompt |
| `onInit(deps)` | Extension factory body |
| `onDestroy()` | `pi.on("session_shutdown", ...)` |

### Memory observer migration (critical path)

The memory observer currently reads `items.jsonl` directly. Post-migration, Pi manages session data in its own tree format. The observer must change its data source.

**Solution:** In the `agent_end` event handler:
1. `event.messages` contains the new messages from the completed prompt
2. `ctx.sessionManager.getEntries()` provides full session history if needed
3. The extension formats a transcript from these Pi message objects (replacing `formatTranscript(items)`)
4. LLM calls use `ctx.modelRegistry` to find the extraction model, then call `generateText()` from the `ai` package with the resolved model
5. Observation storage (`observations.jsonl`, `memory.md`, `cursor.json`) stays file-based and unchanged

```typescript
export default function memoryExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    // Read memory.md, inject into system prompt
    const memory = await readMemoryFromDisk(dataDir);
    if (memory) {
      return { systemPrompt: event.systemPrompt + `\n\n## Memory\n${memory}` };
    }
  });

  pi.on("agent_end", async (event, ctx) => {
    // event.messages = new messages from this prompt
    const transcript = formatTranscriptFromPiMessages(event.messages);
    const model = ctx.modelRegistry.find(provider, modelId);
    // ... extract observations, synthesize memory.md
  });
}
```

**`agents-memory` retains `ai` as a direct dependency** for `generateText()` calls. This is fine — `ai` (Vercel AI SDK) is a lightweight peer dependency, and Pi's `ctx.modelRegistry.find()` returns model objects compatible with it.

### Model provider migration

Replace `OpenRouterModelProvider` with Pi's multi-provider system:

```typescript
const authStorage = AuthStorage.create(authPath);
authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY);
authStorage.setRuntimeApiKey("openai", process.env.OPENAI_API_KEY);
const modelRegistry = new ModelRegistry(authStorage);
```

### Gateway boot sequence changes

Current (`agents-gateway-http/src/runtime.ts`):
```typescript
const config = await loadConfig();
const loaded = await loadPlugins(config.plugins);
runtime = new AgentRuntime({ deps: createFileAdapters(DATA_DIR), config, resolvedPlugins: loaded.runtime });
```

After:
```typescript
const config = await loadConfig();
const gatewayPlugins = await loadGatewayPlugins(config.plugins); // retained, gateway-only
runtime = new AgentRuntime({ config }); // internally creates Pi AgentSession
```

`loadPlugins()` splits into:
- `loadGatewayPlugins()` — retained, loads `GatewayPlugin` instances from `lucy.config.json`
- Runtime plugin loading — removed, replaced by Pi extension discovery from `config.extensions`

### Compaction configuration

Exposed in `lucy.config.json`, passed to Pi's `SettingsManager`:
- `compaction.enabled` (default: `true`)
- `compaction.reserveTokens` (default: `16384`) — tokens reserved for response
- `compaction.keepRecentTokens` (default: `20000`) — recent tokens kept unsummarized

### Extension hot-reload

Pi's `resourceLoader.reload()` re-discovers extensions from disk. Gateway exposes a reload endpoint so the agent can modify its own extensions and pick up changes without restart.

## Key Cases

- **Agent loop delegation.** `sendMessage()` calls `session.prompt()`. Pi handles multi-turn tool loop, persistence, abort, retry.
- **Token-aware compaction.** Structured summaries (Goal/Progress/Decisions/Next Steps) with cumulative file tracking.
- **Multi-provider model access.** Anthropic, OpenAI, Google, Mistral, etc. without custom adapter code.
- **Memory observer on Pi data.** Uses `event.messages` and `ctx.sessionManager` instead of `items.jsonl`. Same extraction pipeline, different data source.
- **Gateway compatibility.** Same `AgentRuntime` public API shape. `sendMessage()` returns response by buffering Pi events. `getHistory()` maps Pi entries to gateway format.
- **Abort support.** `session.abort()` replaces `cancelAgent()`. Cleaner — no module-level AbortController map.
- **Gateway plugins preserved.** `loadGatewayPlugins()` handles WhatsApp, WebUI, landing page plugins independently from Pi extensions.
- **Consumer packages unaffected.** `GatewayPlugin`, `GatewayPluginManifest`, `GatewayPluginInitInput` types remain exported from `agents-runtime`.

## Out of Scope

- Rewriting `agents-gateway-http` routes — stays as-is
- Agent self-modification implementation — this PRD only establishes the boundary
- Memory observation logic changes — same extraction/synthesis pipeline, different data source
- UI/frontend changes — no API contract changes
- Pi terminal UI adoption — SDK only, no TUI
- Multi-user support — single-agent-channel model preserved

## Technical Notes

### Files removed from agents-runtime

`execution.ts`, `compaction.ts`, `context.ts`, `prompt-file.ts`, `messages.ts` (all exports: `itemsToModelMessages`, `itemsToFullModelMessages`, `applySlidingWindow`, `stripImageParts`, `prependSystemPrompt`), `step-persistence.ts`, `environment-context.ts`, `adapters/openrouter-model-provider.ts`, `adapters/file-agent-store.ts`, `adapters/file-item-store.ts`, `plugins/lifecycle.ts`.

### Files modified

**agents-runtime:** `agent-runtime.ts` (rewrite as Pi adapter; `run()` and `cancelAgent()` removed), `ports.ts` (remove `ModelProvider`, `AgentStore`, `ItemStore`; keep `IdentityProvider`, `ConfigStore`), `types.ts` (remove `ChatContext`, `RunResult`, `ModelMessage`; keep `GatewayPlugin*`), `types/plugins.ts` (remove `RuntimePlugin*`, `RuntimePluginManifest`, `DualPluginManifest`; keep `GatewayPlugin*`; `PluginManifest` becomes `GatewayPluginManifest` alias), `plugins/loader.ts` (split → `loadGatewayPlugins()` only), `config/types.ts` (`RuntimeConfig` shape changes to hold Pi settings: `model`, `compaction`, `extensions`), `adapters/index.ts` (`createFileAdapters()` slimmed to config + identity only), `index.ts` (re-export Pi types, preserve `GatewayPlugin*` exports).

**agents-gateway-http:** `runtime.ts` (boot uses `loadGatewayPlugins()`, no `createFileAdapters()`).

**agents-memory:** `observe.ts` (accept Pi messages instead of reading `items.jsonl`), `plugin.ts` (rewrite as Pi extension factory: `export default function(pi: ExtensionAPI)` replacing `createMemoryPlugin()`), `transcript.ts` (accept `AgentMessage[]` instead of `Item[]`), `index.ts` (export extension factory as default export; remove `manifest: PluginManifest` export — Pi discovers extensions by path, not by manifest).

**Consumer packages (type-only):** `agents-plugin-whatsapp` imports `AgentRuntime` (public API preserved) + `GatewayPlugin*` (preserved). `agents-webui` and `agents-landing-page` import `GatewayPlugin*` only — no changes.

### Dependency and config changes

- `agents-runtime`: drops `ai`, `@openrouter/ai-sdk-provider` → adds `@mariozechner/pi-coding-agent`
- `agents-memory`: **prerequisite** — add `"ai": "^4.3.0"` to `package.json` (currently resolved transitively via `agents-runtime` which drops it). Drops `agents-runtime` Item types → adds `@mariozechner/pi-coding-agent`
- `lucy.config.json`: **breaking change** — `compaction` shape changes (`windowSize` → `reserveTokens`/`keepRecentTokens`), `plugins` now gateway-only, extensions under `agents-runtime.extensions`. Existing deployments need config migration.

## Open Questions

- **Extension hot-reload scope.** Does `resourceLoader.reload()` re-initialize already-loaded extensions with new code, or only discover new files? Verify before implementing reload endpoint.
- **Compaction budget defaults.** Pi defaults may need tuning for multi-transport server agents. Expose in config and experiment post-migration.
- **`getModels()` return shape.** Lucy's `ModelConfig` has `supportsReasoning`, `supportsImages`, `maxContextTokens`. Pi's model objects may have different fields. Verify compatibility or define a mapping.

## References

- [Resolved Questions](./resolved-questions.md) — 6 originally-open questions investigated and resolved
- [Harness Convergence Analysis](../../findings/harness-convergence-analysis.md) — architectural comparison
- [Pi SDK docs](~/.nvm/versions/node/v24.13.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md)
- [Pi Extensions](~/.nvm/versions/node/v24.13.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md)
- [Pi Compaction](~/.nvm/versions/node/v24.13.0/lib/node_modules/@mariozechner/pi-coding-agent/docs/compaction.md)
- [Pi Full Control Example](~/.nvm/versions/node/v24.13.0/lib/node_modules/@mariozechner/pi-coding-agent/examples/sdk/12-full-control.ts)
- [Extract Agent Runtime PRD](../extract-agent-runtime-and-gateways/README.md) (completed)
- [Single Agent Channel PRD](../single-agent-channel/README.md) (completed)
- [Runtime Plugin Interface PRD](../runtime-plugin-interface-and-memory-scaffold/README.md) (completed)
- [Memory Observer PRD](../memory-observer/README.md) (in-progress)
