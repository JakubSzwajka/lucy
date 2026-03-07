---
prd: runtime-plugin-interface-and-memory-scaffold
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Add Runtime Plugin Interface And Memory Scaffold

> Summary: Add a formal plugin seam to `agents-runtime`, then scaffold a separate memory package that registers through that seam and proves lifecycle hook wiring without implementing the full memory system.
> Summary: Add a formal plugin seam and plugin-aware runtime configuration to `agents-runtime`, then scaffold a separate memory package and bootstrap path that prove configured plugin resolution without implementing the full memory system.

## Task List

- [x] **1. Define plugin contract in `agents-runtime`** — add the core plugin types, hook payloads, and runtime config types
- [x] **2. Add plugin registry and bootstrap path** — resolve configured plugins into a runtime instance `[blocked by: 1]`
- [x] **3. Wire plugin lifecycle into `AgentRuntime`** — invoke resolved plugins during context preparation and run completion `[blocked by: 1, 2]`
- [x] **4. Scaffold `agents-memory` package** — create a new workspace package for memory plugin code `[blocked by: 1]`
- [x] **5. Implement the memory plugin scaffold** — add a minimal plugin that contributes memory context and observes completed runs `[blocked by: 3, 4]`
- [x] **6. Add a configured runtime example/bootstrap integration** — prove one configured runtime can be reused by transports without transport-specific plugin wiring `[blocked by: 2, 5]`
- [x] **7. Export and document the plugin/bootstrap API** — make the contract public and explain configured plugin resolution `[blocked by: 2, 3, 5]`
- [x] **8. Add runtime and plugin verification coverage** — prove configured plugin resolution is optional and memory plugin hooks execute `[blocked by: 3, 5, 6]`

---

### 1. Define plugin contract in `agents-runtime`
<!-- status: done -->

Create the minimal plugin API inside `agents-runtime` rather than burying it in `AgentRuntime` internals. Define plugin-facing types for hook inputs and outputs so the runtime owns merge rules and plugins return structured contributions instead of mutating shared objects directly. Add runtime config types that describe enabled plugins and plugin-specific config by stable plugin id. Keep the surface narrow: enough for context enrichment and post-run observation, but not a general-purpose tool framework yet.

**Files:** `agents-runtime/src/types.ts`, `agents-runtime/src/runtime.ts`, `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** `agents-runtime` types compile with a public `RuntimePlugin` contract and runtime config types for selecting zero or more plugins

---

### 2. Add plugin registry and bootstrap path
<!-- status: done -->

Add the code path that turns runtime configuration into resolved plugin instances. This should be a bootstrap-oriented API that takes runtime config plus a registry of installed plugin implementations and returns a configured `AgentRuntime`, so transports can reuse one configured runtime instead of wiring plugins themselves. Keep resolution explicit and type-safe; do not make runtime config directly load arbitrary packages.

**Files:** `agents-runtime/src/runtime.ts`, `agents-runtime/src/types.ts`, `agents-runtime/src/index.ts`
**Depends on:** 1
**Validates:** A bootstrap API can create a configured runtime from runtime config plus an installed plugin registry; no transport-specific code is required to select plugins

---

### 3. Wire plugin lifecycle into `AgentRuntime`
<!-- status: done -->

Update `AgentRuntime` to work with resolved plugins, preserve current behavior when none are configured, and invoke plugin hooks at the agreed lifecycle points. The first hook path should cover context preparation so plugins can contribute system/context sections, and a completion hook so plugins can observe finished runs without coupling to the execution loop internals. Runtime code should define ordering and error-handling rules explicitly.

**Files:** `agents-runtime/src/runtime.ts`, `agents-runtime/src/types.ts`
**Depends on:** 1, 2
**Validates:** `new AgentRuntime()` behaves as before; a configured runtime created via bootstrap calls plugin hooks during `prepareContext()` and run finalization

---

### 4. Scaffold `agents-memory` package
<!-- status: done -->

Create a new workspace package that will own memory-specific plugin code instead of placing it under `agents-runtime`. Match the existing package conventions: TypeScript package, local README, and exports that depend on `agents-runtime` rather than the other way around. Update the root workspace configuration so the new package installs and resolves as a sibling dependency.

**Files:** `package.json`, `agents-memory/package.json`, `agents-memory/tsconfig.json`, `agents-memory/src/index.ts`, `agents-memory/README.md`
**Depends on:** 1
**Validates:** `npm install` links `agents-memory` as a workspace package; TypeScript in `agents-memory` can import plugin types from `agents-runtime`

---

### 5. Implement the memory plugin scaffold
<!-- status: done -->

Add the first concrete plugin implementation in `agents-memory`. This should be intentionally thin: a factory such as `createMemoryPlugin(...)`, minimal config/state types, and hook implementations that prove both directions of the seam by contributing a small memory context block and observing run completion for later async processing. Do not implement extraction pipelines, background jobs, or durable ranking here; this task is only about the plugin shape and ownership boundary.

**Files:** `agents-memory/src/index.ts`, `agents-memory/src/plugin.ts`, `agents-memory/src/types.ts`, `agents-memory/README.md`
**Depends on:** 3, 4
**Validates:** `agents-memory` exports a plugin factory that satisfies the runtime contract and can be instantiated without changing `agents-runtime`

---

### 6. Add a configured runtime example/bootstrap integration
<!-- status: done -->

Add one neutral bootstrap/example path that proves the runtime can be configured once and reused by transports without transport-specific plugin wiring. This can live as an example module, a helper under `agents-runtime`, or a small script that assembles runtime config plus installed plugins and returns a ready-to-use runtime instance. The goal is to make the “configured runtime deployment” concrete without coupling the design to HTTP.

**Files:** `agents-runtime/src/index.ts`, `agents-runtime/scripts/smoke-test.ts`, `agents-memory/src/index.ts`, `package.json`
**Depends on:** 2, 5
**Validates:** One bootstrap path creates a configured runtime with the memory plugin selected by config, and that runtime can be reused without plugin-specific transport wiring

---

### 7. Export and document the plugin/bootstrap API
<!-- status: done -->

Make the plugin and bootstrap boundary part of the package contract instead of an internal experiment. Re-export the plugin types and bootstrap helpers from the runtime entry point and update package documentation so another package or deployment can implement and install plugins without reading runtime internals. The README should show configured plugin resolution rather than manual transport-level plugin wiring.

**Files:** `agents-runtime/src/index.ts`, `agents-runtime/README.md`, `agents-memory/README.md`
**Depends on:** 2, 3, 5
**Validates:** A package consumer can import the plugin/bootstrap API from `agents-runtime`; docs explain how installed plugins are selected by runtime config

---

### 8. Add runtime and plugin verification coverage
<!-- status: done -->

Extend the existing smoke-test style verification so plugin behavior is exercised end-to-end. Cover both the no-plugin baseline and the configured-memory-plugin path: the runtime should still work unchanged without plugins, and with the memory plugin enabled in runtime config it should resolve the plugin, call the hooks, and surface the scaffolded memory contribution. Keep this verification lightweight and local to the current workspace patterns.

**Files:** `agents-runtime/scripts/smoke-test.ts`, `agents-memory/src/plugin.ts`, `agents-runtime/README.md`, `agents-memory/README.md`
**Depends on:** 3, 5, 6
**Validates:** Smoke/integration checks pass for both runtime-without-plugins and runtime-with-configured-memory-plugin scenarios
