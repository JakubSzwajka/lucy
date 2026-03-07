---
prd: unified-config-file
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Unified Config File (`lucy.config.json`)

> Summary: Add a `lucy.config.json` config file loader and wire it through the gateway so deployments can declaratively enable plugins and configure modules without writing TypeScript.

## Task List

- [x] **1. Define the unified config type and loader** — shared utility that reads and validates `lucy.config.json`
- [x] **2. Extract a shared runtime singleton in the gateway** — replace per-route `new AgentRuntime()` with a single bootstrapped instance
- [x] **3. Wire config loader into the gateway entrypoint** — load `lucy.config.json` at startup and pass to bootstrap
- [x] **4. Register known plugins in the gateway** — build the plugin registry so config-enabled plugins resolve
- [x] **5. Mount config file in Docker** — update Dockerfile and Makefile for config volume
- [x] **6. Add example config and update docs** — ship a `lucy.config.example.json` and update README

---

### 1. Define the unified config type and loader
<!-- status: done -->

Create a `loadConfig(path?: string)` function in a new shared location (e.g. `agents-runtime/src/config/load-config.ts`). It reads `lucy.config.json` from `path`, falling back to `LUCY_CONFIG_PATH` env var, then `./lucy.config.json`. If the file doesn't exist, return an empty config (zero-config works). Parse JSON and do runtime type checks: top-level must be an object, each known key (`agents-runtime`, `agents-memory`, `agents-gateway-http`) must be an object if present. Export a `LucyConfig` type with optional keys per module. Export the `agents-runtime` section type as `RuntimeConfig` (already exists) and a thin `GatewayConfig` type for future use.

**Files:** `agents-runtime/src/config/load-config.ts` (new), `agents-runtime/src/config/types.ts` (new), `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** Calling `loadConfig()` with no file returns empty defaults. Calling with a valid JSON file returns parsed sections. Calling with malformed JSON throws a clear error.

---

### 2. Extract a shared runtime singleton in the gateway
<!-- status: done -->

Currently `agents-gateway-http/src/routes/chat.ts` and `sessions.ts` each create `new AgentRuntime(createFileAdapters(DATA_DIR))` — no plugins, no config. Refactor to a single `createGatewayRuntime()` in `agents-gateway-http/src/runtime.ts` that calls `bootstrapAgentRuntime()` once and is shared across routes. Routes receive the runtime instance via Hono context or module-level reference. This is a prerequisite for config/plugin support.

**Files:** `agents-gateway-http/src/runtime.ts` (new), `agents-gateway-http/src/routes/chat.ts`, `agents-gateway-http/src/routes/sessions.ts`, `agents-gateway-http/src/server.ts`
**Depends on:** —
**Validates:** Gateway starts, `/health` returns OK, chat and session routes work with the shared runtime (manual or smoke test).

---

### 3. Wire config loader into the gateway entrypoint
<!-- status: done -->

Call `loadConfig()` at gateway startup in `agents-gateway-http/src/index.ts` (or `runtime.ts` from task 2). Pass the `agents-runtime` section as `config` to `bootstrapAgentRuntime()`. This connects the JSON file to the existing programmatic config path — no new runtime behavior, just a new input source.

**Files:** `agents-gateway-http/src/index.ts`, `agents-gateway-http/src/runtime.ts`, `agents-gateway-http/package.json` (if import needed)
**Depends on:** 1, 2
**Validates:** Create a `lucy.config.json` with `{"agents-runtime": {"plugins": {"enabled": []}}}`, start the gateway — it loads the file and logs config loaded (or similar). Missing file still starts cleanly.

---

### 4. Register known plugins in the gateway
<!-- status: done -->

The config file says *which* plugins are enabled, but the plugin registry (code-level map of plugin ID → plugin instance) must still be assembled in code. Add a `buildPluginRegistry()` in the gateway that imports known plugins (`createMemoryPlugin` from `agents-memory`) and returns the registry map. Pass this to `bootstrapAgentRuntime({ pluginRegistry })`. This is the bridge between declarative config and code-defined plugins.

**Files:** `agents-gateway-http/src/plugins.ts` (new), `agents-gateway-http/src/runtime.ts`, `agents-gateway-http/package.json`
**Depends on:** 2, 3
**Validates:** Add `"agents-runtime": {"plugins": {"enabled": ["memory"], "configById": {"memory": {"initialMemory": {"content": "Hello", "title": "Test"}}}}}` to `lucy.config.json`. Start gateway, send a chat message — memory plugin injects content into system prompt.

---

### 5. Mount config file in Docker
<!-- status: done -->

Update the Dockerfile to copy a default `lucy.config.json` into the image (empty/minimal defaults). Add a `docker-run` volume mount option in the Makefile so operators can override with their own config. Document `LUCY_CONFIG_PATH` env var as an alternative.

**Files:** `Dockerfile`, `Makefile`, `lucy.config.json` (new, minimal default)
**Depends on:** 3
**Validates:** `make docker-build && make docker-run` starts with default config. Mounting a custom config file activates its settings.

---

### 6. Add example config and update docs
<!-- status: done -->

Create `lucy.config.example.json` showing all available sections with comments-as-descriptions (or a companion doc). Update the root README to mention the config file, env var, and Docker mount. Keep it brief — link to the PRD for full details.

**Files:** `lucy.config.example.json` (new), `README.md`
**Depends on:** 4
**Validates:** Example file is valid JSON and documents all current config keys.

---
