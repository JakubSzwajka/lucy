---
prd: plugin-package-system
generated: 2026-03-08
last-updated: 2026-03-08
---

# Tasks: Plugin Package System

> Summary: Replace hardcoded plugin imports and registries with a dynamic loader that reads package names from `lucy.config.json` and uses `import()` to load them. Each plugin exports a standard `PluginManifest`.

## Task List

- [x] **1. Move GatewayPlugin types into agents-runtime** — generalize and co-locate with RuntimePlugin so all plugin contracts live in one place
- [x] **2. Define PluginManifest type in agents-runtime** — new type that plugins export to describe themselves `[blocked by: 1]`
- [x] **3. Add manifest export to agents-memory** — convert from `createMemoryPlugin` + `MEMORY_PLUGIN_ID` to a `manifest` export `[blocked by: 2]`
- [x] **4. Add manifest export to agents-plugin-whatsapp** — convert from `createWhatsAppPlugin` + `WHATSAPP_PLUGIN_ID` to a `manifest` export `[blocked by: 2]`
- [x] **5. Restructure lucy.config.json to flat plugins array** — replace nested `agents-runtime.plugins` / `agents-gateway-http.plugins` with top-level `plugins`
- [x] **6. Build the dynamic plugin loader** — reads config, dynamically imports packages, validates manifests, returns resolved plugins `[blocked by: 2, 5]`
- [x] **7. Wire loader into gateway bootstrap** — replace hardcoded registries with the dynamic loader `[blocked by: 3, 4, 6]`
- [x] **8. Clean up dead code** — remove old registry files, resolve functions, ID constants `[blocked by: 7]`
- [x] **9. Simplify Dockerfile** — replace per-plugin COPY lines with workspace-aware patterns `[blocked by: 7]`

---

### 1. Move GatewayPlugin types into agents-runtime
<!-- status: done -->

Move `GatewayPlugin`, `GatewayPluginInitInput`, `GatewayPluginConfig`, `ResolvedGatewayPlugin`, and `GatewayPluginsConfig` from `agents-gateway-http/src/types/gateway-plugins.ts` into `agents-runtime/src/types/plugins.ts`. Generalize the `app` parameter — instead of `app: Hono`, use `app: TApp` (generic, defaults to `unknown`). The HTTP gateway is just one adapter that passes a Hono instance; the type shouldn't know about Hono. Update imports in `agents-gateway-http` and `agents-plugin-whatsapp` to point to `agents-runtime`. Re-export from `agents-gateway-http/src/types/gateway-plugins.ts` temporarily for any internal consumers.

**Files:** `agents-runtime/src/types/plugins.ts`, `agents-runtime/src/index.ts`, `agents-gateway-http/src/types/gateway-plugins.ts`, `agents-plugin-whatsapp/src/index.ts`
**Depends on:** —
**Validates:** `import { GatewayPlugin } from "agents-runtime"` works; `agents-plugin-whatsapp` no longer imports from `agents-gateway-http`; typecheck passes

---

### 2. Define PluginManifest type in agents-runtime
<!-- status: done -->

Add a `PluginManifest<TConfig>` type that wraps the runtime/gateway plugin contracts. The manifest declares `id`, `type` (`"runtime" | "gateway" | "both"`), and a `create` factory function that receives config and returns the appropriate plugin hooks. Export it from the package's public API. Keep the existing `RuntimePlugin` and `GatewayPlugin` interfaces — the manifest wraps them, it doesn't replace them.

**Files:** `agents-runtime/src/types/plugins.ts`, `agents-runtime/src/index.ts`
**Depends on:** 1
**Validates:** `import { PluginManifest } from "agents-runtime"` resolves with correct type shape

---

### 3. Add manifest export to agents-memory
<!-- status: done -->

Add `export const manifest: PluginManifest<MemoryPluginConfig>` to `agents-memory/src/index.ts`. The manifest's `create` function should wrap the existing `createMemoryPlugin` call. Keep backward-compatible exports (`createMemoryPlugin`, `MEMORY_PLUGIN_ID`) until task 8 removes consumers. The `type` should be `"runtime"` since memory only has runtime hooks.

**Files:** `agents-memory/src/index.ts`
**Depends on:** 2
**Validates:** `import("agents-memory").then(m => m.manifest)` returns a valid manifest object

---

### 4. Add manifest export to agents-plugin-whatsapp
<!-- status: done -->

Add `export const manifest: PluginManifest<WhatsAppPluginConfig>` to `agents-plugin-whatsapp/src/index.ts`. The manifest's `create` function wraps `createWhatsAppPlugin`. Type is `"gateway"`. Since task 1 already moved `GatewayPlugin` into `agents-runtime`, this plugin now depends only on `agents-runtime` for types.

**Files:** `agents-plugin-whatsapp/src/index.ts`
**Depends on:** 2
**Validates:** `import("agents-plugin-whatsapp").then(m => m.manifest)` returns a valid manifest

---

### 5. Restructure lucy.config.json to flat plugins array
<!-- status: done -->



Replace the current nested plugin config structure with a flat top-level `plugins` array. Update `LucyConfig` type in `agents-runtime/src/config/types.ts` and the config loader/validator in `load-config.ts`. The new shape: `{ plugins: [{ package: "agents-memory", config: {...} }], "agents-runtime": { compaction: {...} } }`. Keep non-plugin config (like `compaction`) where it is. Update `lucy.config.example.json` to show the new format.

**Files:** `agents-runtime/src/config/types.ts`, `agents-runtime/src/config/load-config.ts`, `lucy.config.example.json`
**Depends on:** —
**Validates:** Config loads and parses correctly with new shape; old nested `plugins` key rejected or ignored

---

### 6. Build the dynamic plugin loader
<!-- status: done -->

Create a `loadPlugins` function (in `agents-runtime/src/plugins/`) that takes the `plugins` array from config, does `await import(entry.package)` for each, validates that the imported module has a `.manifest` export conforming to `PluginManifest`, calls `manifest.create(entry.config)`, and returns separate arrays of resolved runtime and gateway plugins. Errors must be clear: missing package, missing manifest export, invalid manifest shape. This replaces both `resolveRuntimePlugins` and `resolveGatewayPlugins`.

**Files:** `agents-runtime/src/plugins/loader.ts` (new), `agents-runtime/src/index.ts`
**Depends on:** 2, 5
**Validates:** Loader successfully imports `agents-memory` by package name, returns resolved runtime plugin; throws descriptive error for missing/invalid packages

---

### 7. Wire loader into gateway bootstrap
<!-- status: done -->

Replace the gateway's manual plugin wiring with the new loader. In `agents-gateway-http/src/index.ts`, call `loadPlugins(config.plugins)` instead of `buildPluginRegistry()` + `resolveRuntimePlugins()` + `buildGatewayPluginRegistry()` + `resolveGatewayPlugins()`. Pass runtime plugins to `bootstrapAgentRuntime` and gateway plugins to `initGatewayPlugins` as before. The gateway should have zero direct imports from plugin packages.

**Files:** `agents-gateway-http/src/index.ts`, `agents-gateway-http/src/runtime.ts`, `agents-gateway-http/src/plugins.ts`
**Depends on:** 3, 4, 6
**Validates:** Gateway starts with `lucy.config.json` listing `agents-memory` and `agents-plugin-whatsapp`; both plugins initialize correctly; removing a plugin from config means it's not loaded

---

### 8. Clean up dead code
<!-- status: done -->

Remove the old wiring code that's no longer needed: `agents-gateway-http/src/plugins.ts` (hardcoded runtime registry), `agents-gateway-http/src/gateway-plugins/plugins.ts` (hardcoded gateway registry), `agents-gateway-http/src/gateway-plugins/registry.ts` (resolve function), `agents-runtime/src/plugins/registry.ts` (resolve function). Remove `MEMORY_PLUGIN_ID` and `WHATSAPP_PLUGIN_ID` constants if no longer referenced. Clean up re-exports from `agents-runtime/src/index.ts`. Remove the temporary re-exports from `agents-gateway-http/src/types/gateway-plugins.ts` added in task 1.

**Files:** `agents-gateway-http/src/plugins.ts`, `agents-gateway-http/src/gateway-plugins/plugins.ts`, `agents-gateway-http/src/gateway-plugins/registry.ts`, `agents-runtime/src/plugins/registry.ts`, `agents-runtime/src/index.ts`, `agents-memory/src/index.ts`, `agents-plugin-whatsapp/src/index.ts`, `agents-gateway-http/src/types/gateway-plugins.ts`
**Depends on:** 7
**Validates:** No import of old registry/resolve functions anywhere; `npm run typecheck` passes for all packages

---

### 9. Simplify Dockerfile
<!-- status: done -->

Replace the per-plugin COPY lines with a pattern that handles any number of workspace packages. For the deps stage, use a loop or multi-line COPY for `agents-*/package.json`. For source/build, copy all `agents-*/` dirs. This way adding a new plugin package requires zero Dockerfile changes.

**Files:** `Dockerfile`
**Depends on:** 7
**Validates:** `docker build` succeeds; gateway starts inside container with both plugins
