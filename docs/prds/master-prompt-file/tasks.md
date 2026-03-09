---
prd: master-prompt-file
generated: 2026-03-08
last-updated: 2026-03-08
---

# Tasks: Master Prompt File (`prompt.md`)

> Summary: Introduce a file-based master system prompt (`prompt.md`) that replaces agent-level `systemPrompt` / `systemPromptId` resolution, and update Docker configuration to mount it as a separate volume.

## Task List

- [x] **1. Add prompt file reader to runtime init** — Read `prompt.md` at startup, cache content in memory, expose to context assembly
- [x] **2. Wire cached prompt into context assembly** — Replace `resolveSystemPrompt()` with the cached prompt.md content as the base system prompt
- [x] **3. Remove `systemPrompt` from Agent type** — Drop the optional `systemPrompt` field from the `Agent` interface and all usages
- [x] **4. Remove `systemPromptId` from AgentConfig and ConfigStore** — Drop `systemPromptId` from `AgentConfig`, remove `getSystemPrompt`/`createSystemPrompt` from `ConfigStore`, and clean up `FileConfigStore`
- [x] **5. Remove `SystemPrompt` type and re-exports** — Delete the `SystemPrompt` interface and remove it from ports, index re-exports, and any remaining references
- [x] **6. Update Docker and docker-compose for prompt.md volume** — Mount `prompt.md` as a read-only volume separate from the data directory

---

### 1. Add prompt file reader to runtime init
<!-- status: done -->

Create a small module that reads `/app/prompt.md` (or a conventional path) synchronously at init time and caches the UTF-8 content as a string. If the file is missing, log a warning and return `null`. Call this during `AgentRuntime.init()` and store the result on the runtime instance so context assembly can access it. The path is convention-based (`/app/prompt.md` in production, configurable via an argument or env for local dev).

**Files:** `agents-runtime/src/runtime/prompt-file.ts` (new), `agents-runtime/src/runtime/agent-runtime.ts`
**Depends on:** —
**Validates:** Runtime starts successfully with and without a `prompt.md` file present; cached content matches file contents.

---

### 2. Wire cached prompt into context assembly
<!-- status: done -->

Replace the `resolveSystemPrompt()` function in `context.ts` with the cached prompt content from task 1. The function currently checks `agent.systemPrompt` then `agentConfig.systemPromptId` — both paths are removed. Instead, `prepareRuntimeContext` receives the cached prompt string (or `null`) and uses it as the base for the system prompt assembly chain. The rest of the chain (environment context, identity, plugin sections) continues appending on top unchanged.

**Files:** `agents-runtime/src/runtime/context.ts`, `agents-runtime/src/runtime/agent-runtime.ts`
**Depends on:** 1
**Validates:** System prompt in `ChatContext` starts with the content from `prompt.md` followed by environment/identity/plugin sections.

---

### 3. Remove `systemPrompt` from Agent type
<!-- status: done -->

Delete the `systemPrompt?: string | null` field from the `Agent` interface in `domain.ts`. Update `ensureAgent()` in `agent-runtime.ts` which creates the default agent object (no field to remove since it's already not set there). Check the file-based agent store adapter for any serialization of this field. The legacy app references in `.legacy/` are out of scope.

**Files:** `agents-runtime/src/types/domain.ts`, `agents-runtime/src/runtime/context.ts`
**Depends on:** 2
**Validates:** TypeScript compiles with no errors; no runtime code references `agent.systemPrompt`.

---

### 4. Remove `systemPromptId` from AgentConfig and ConfigStore
<!-- status: done -->

Remove `systemPromptId: string | null` from the `AgentConfig` interface. Remove `getSystemPrompt()` and `createSystemPrompt()` from the `ConfigStore` port interface. Remove the corresponding implementations from `FileConfigStore`. Update `ensureAgent()` in `agent-runtime.ts` which currently passes `systemPromptId: null` when creating the default config. Update the `isConfigStoreLike` type guard that checks for `getAgentConfig`.

**Files:** `agents-runtime/src/types/domain.ts`, `agents-runtime/src/ports.ts`, `agents-runtime/src/adapters/file-config-store.ts`, `agents-runtime/src/runtime/agent-runtime.ts`
**Depends on:** 2
**Validates:** TypeScript compiles; `ConfigStore` interface has only `getAgentConfig` and `createAgentConfig` methods.

---

### 5. Remove `SystemPrompt` type and re-exports
<!-- status: done -->

Delete the `SystemPrompt` interface from `domain.ts`. Remove its import from `ports.ts` and the re-export from `agents-runtime/src/index.ts`. Also remove the `SystemPrompt` re-export from any gateway or external consumer imports. This is the final cleanup — after this, no code in the active packages references the old system prompt entity.

**Files:** `agents-runtime/src/types/domain.ts`, `agents-runtime/src/ports.ts`, `agents-runtime/src/index.ts`
**Depends on:** 4
**Validates:** TypeScript compiles; `SystemPrompt` does not appear in any non-legacy `.ts` file.

---

### 6. Update Docker and docker-compose for prompt.md volume
<!-- status: done -->

Add a `prompt.md` volume mount to `docker-compose.yml` for the gateway service: `./prompt.md:/app/prompt.md:ro`. This is separate from the data directory mount. In the `Dockerfile`, use the same conditional copy pattern as `lucy.config.json` (`COPY prompt.m[d] ./`) so builds succeed even without the file in the build context.

**Files:** `docker-compose.yml`, `Dockerfile`
**Depends on:** —
**Validates:** `docker compose config` shows the prompt.md volume; Docker builds succeed with and without `prompt.md` in the build context.
