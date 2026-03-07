---
prd: shared-data-directory
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Shared Data Directory for Agent Consumers

> Summary: Standardize data directory resolution in agents-runtime so all consumers (HTTP gateway, future CLI) resolve the same path via a consistent chain: explicit param > `AGENTS_DATA_DIR` env var > `~/.agents-data`.

## Task List

- [x] **1. Add resolveDataDir utility to agents-runtime** — centralize path resolution logic
- [x] **2. Update createFileAdapters to use resolveDataDir** — wire new default into adapter factory
- [x] **3. Update AgentRuntime constructor** — pass resolved dataDir to fallback adapters
- [x] **4. Update agents-gateway-http to use AGENTS_DATA_DIR** — switch from gateway-local DATA_DIR to shared env var
- [x] **5. Update documentation and smoke tests** — reflect new env var and default path `[blocked by: 1, 2, 3, 4]`

---

### 1. Add resolveDataDir utility to agents-runtime
<!-- status: done -->

Create a `resolveDataDir` function in `agents-runtime/src/adapters/resolve-data-dir.ts` that implements the resolution chain: if an explicit `dataDir` string is provided, use it; otherwise read `AGENTS_DATA_DIR` env var; otherwise default to `~/.agents-data` (using `os.homedir()`). Export it from the adapters index and the package root.

**Files:** `agents-runtime/src/adapters/resolve-data-dir.ts` (new), `agents-runtime/src/adapters/index.ts`, `agents-runtime/src/index.ts`
**Depends on:** —
**Validates:** Calling `resolveDataDir()` with no args returns `~/.agents-data`; with env var set returns env value; with explicit arg returns the arg.

---

### 2. Update createFileAdapters to use resolveDataDir
<!-- status: done -->

Change the `createFileAdapters` default from hardcoded `".agents-data"` to `resolveDataDir()`. The function signature stays the same (`dataDir?: string`) but now the undefined case resolves through the standard chain instead of a CWD-relative default.

**Files:** `agents-runtime/src/adapters/index.ts`
**Depends on:** 1
**Validates:** `createFileAdapters()` (no args) creates stores pointing at `~/.agents-data` by default.

---

### 3. Update AgentRuntime constructor
<!-- status: done -->

The `AgentRuntime` constructor currently calls `createFileAdapters()` with no args as a fallback. After task 2, this automatically uses `resolveDataDir()`. No code change needed if task 2 is done correctly — but verify the constructor still works when consumers pass explicit adapter overrides (gateway-http passes its own adapters).

**Files:** `agents-runtime/src/runtime.ts`
**Depends on:** 2
**Validates:** `new AgentRuntime()` with no deps uses `~/.agents-data`; `new AgentRuntime(explicitDeps)` still uses explicit deps.

---

### 4. Update agents-gateway-http to use AGENTS_DATA_DIR
<!-- status: done -->

Replace the gateway's `DATA_DIR` config (`process.env.DATA_DIR ?? ".agents-data"`) with importing `resolveDataDir` from agents-runtime. This removes the gateway's independent path resolution and aligns it with the shared contract. Update all `DATA_DIR` usages in session and chat routes to use the resolved value.

**Files:** `agents-gateway-http/src/config.ts`, `agents-gateway-http/src/routes/sessions.ts`, `agents-gateway-http/src/routes/chat.ts`
**Depends on:** 1
**Validates:** Gateway starts and reads/writes to `~/.agents-data` by default; setting `AGENTS_DATA_DIR=/tmp/test` routes all data there.

---

### 5. Update documentation and smoke tests
<!-- status: done -->

Update README files for both packages to document `AGENTS_DATA_DIR` and the new default `~/.agents-data`. Update the e2e test script to use `AGENTS_DATA_DIR` instead of `DATA_DIR`. Update the smoke test if it references the old default.

**Files:** `agents-runtime/README.md`, `agents-gateway-http/README.md`, `agents-gateway-http/scripts/e2e-test.sh`, `agents-runtime/scripts/smoke-test.ts`
**Depends on:** 1, 2, 3, 4
**Validates:** READMEs mention `AGENTS_DATA_DIR`; e2e test passes with the new env var; smoke test passes.

---
