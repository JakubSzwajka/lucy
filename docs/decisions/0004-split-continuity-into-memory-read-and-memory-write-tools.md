---
status: proposed
date: 2026-02-18
decision-makers: kuba
---

# Split continuity into memory_read and memory_write tools

## Context and Problem Statement

The current `continuity` tool exposes all memory operations (save, find, list, update, supersede, delete, resolve_question) as a single parameterised tool. Agent configs control which tools an agent can access, but there's no way to grant an agent read-only memory access — assigning the `continuity` tool gives full read+write.

We need to split this into two tools so that some agents can be configured with memory read access only.

Additionally, the Obsidian-backed `memory` module is no longer needed and should be removed as part of this change.

## Decision

Replace the single `continuity` tool and the Obsidian `memory` module with two new tool modules:

### `memory_read` (read-only)
- **Actions**: `find`, `list`
- Pure DB reads via `MemoryService.search()` and `MemoryService.list()`
- Must not trigger agent reflection or any write side-effects
- Source: `{ type: "builtin", moduleId: "memory_read" }`

### `memory_write` (mutating)
- **Actions**: `save`, `update`, `supersede`, `delete`, `resolve_question`
- All write operations via `MemoryService` and `QuestionService`
- Source: `{ type: "builtin", moduleId: "memory_write" }`

### Non-goals
- No changes to the memory service layer (`@/lib/server/memory`) or DB schema
- No new API routes
- No migration of Obsidian memory data

## Consequences

* Good, because agents can be granted read-only memory access via agent config tool assignments
* Good, because removing the Obsidian `memory` module simplifies the tool surface
* Bad, because existing agent configs referencing `continuity` will need updating (manual DB update or migration)

## Implementation Plan

* **Affected paths**:
  - `backend/src/lib/server/tools/modules/continuity/` — delete entirely
  - `backend/src/lib/server/tools/modules/memory/` — replace Obsidian module with new `memory_read` module
  - `backend/src/lib/server/tools/modules/memory-write/` — new directory for `memory_write` module
  - `backend/src/lib/server/tools/modules/index.ts` — update exports and `allToolModules` array

* **Dependencies**: None added or removed. Existing `@/lib/server/memory` services unchanged.

* **Patterns to follow**:
  - `defineToolModule` / `defineTool` pattern from `../../types`
  - Each module has `id`, `name`, `description`, `integrationId: null` (no external integration)
  - Input schema uses zod with `.optional()` fields per action
  - Execute function validates required fields per action branch

* **Patterns to avoid**:
  - Do not import or reference `ObsidianClient` or `conversationsIntegration`
  - Do not trigger reflection or any async background work in `memory_read`

### Steps

1. Create `backend/src/lib/server/tools/modules/memory-read/index.ts` with `find` and `list` actions extracted from current continuity tool
2. Create `backend/src/lib/server/tools/modules/memory-write/index.ts` with `save`, `update`, `supersede`, `delete`, `resolve_question` actions extracted from current continuity tool
3. Delete `backend/src/lib/server/tools/modules/continuity/`
4. Replace `backend/src/lib/server/tools/modules/memory/index.ts` (remove Obsidian module)
5. Update `backend/src/lib/server/tools/modules/index.ts` — remove old imports, add new modules
6. Update `backend/src/lib/server/tools/modules/memory/README.md` and `continuity/README.md` (or delete and create new READMEs)

### Verification

- [ ] `memory_read` tool only calls `service.search()` and `service.list()` — no writes
- [ ] `memory_write` tool handles all 5 mutating actions correctly
- [ ] Old `continuity` module and Obsidian `memory` module are fully removed
- [ ] `allToolModules` in `index.ts` exports both new modules
- [ ] `npm run build` in `backend/` succeeds with no type errors
- [ ] Agent config with only `memory_read` assigned cannot trigger any writes

## Alternatives Considered

* **Keep one tool, add a `readonly` flag**: Rejected — tool filtering in agent configs operates at the tool name level, not at the parameter level. A flag would still require the agent to self-enforce read-only, which is unreliable.
* **Three tools (read/write/admin)**: Rejected — over-engineering for current needs. `delete` and `supersede` don't need separate access control from `save`/`update`.
