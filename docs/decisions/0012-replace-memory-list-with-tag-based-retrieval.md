---
status: proposed
date: 2026-02-19
decision-makers: kuba
---

# Replace memory list with tag-based retrieval

## Context and Problem Statement

The continuity tool's `list` action returns all memories (up to 100 per page). The master agent uses this as a brute-force shortcut to understand what it knows about the user — dumping every memory into context. This is expensive in tokens and doesn't scale as the memory count grows.

Human memory works associatively: you recall topics first, then retrieve specific memories by association. The tool should work the same way — let the agent see what tags/keywords exist, pick the relevant ones, then query memories by those tags.

Additionally, the Obsidian-backed `memory` module is dead code that should be removed (ADR-0004 also proposes this).

## Decision

### 1. Add `list_tags` action to the continuity tool

Returns all distinct tags across the user's active memories with counts. The agent uses this to understand what knowledge areas exist, then calls `find` with specific keywords to retrieve relevant memories.

### 2. Comment out the `list` action

Keep the code but disable it. The action will not be advertised in the tool description or accepted at runtime. This preserves the implementation for potential future use (e.g., admin tooling) without giving the agent a brute-force path.

### 3. Remove the Obsidian `memory` module

Delete `backend/src/lib/tools/modules/memory/` entirely and remove its export from the modules index. This module depends on `ObsidianClient` and `conversationsIntegration` which are no longer part of the active architecture.

### Non-goals

- No changes to the `find` action (keyword search stays as-is)
- No changes to the `memories` DB schema or `MemoryService`
- No changes to write actions (`save`, `update`, `supersede`, `delete`, `resolve_question`)
- No new API routes

## Consequences

* Good, because the agent can no longer dump all memories into context — forces associative retrieval
* Good, because `list_tags` is O(1) in token cost relative to memory count (just tag names + counts)
* Good, because removing the Obsidian module eliminates dead code and a stale integration dependency
* Bad, because if tags are poorly assigned, `list_tags` won't surface the right associations — quality depends on tag discipline during memory creation
* Neutral, because `list` is commented out, not deleted — easy to restore if needed

## Implementation Plan

### Affected paths

- `backend/src/lib/tools/modules/continuity/index.ts` — add `list_tags`, comment out `list`
- `backend/src/lib/tools/modules/memory/` — delete directory
- `backend/src/lib/tools/modules/index.ts` — remove `memoryModule` export
- `backend/src/lib/memory/memory.service.ts` — add `listTags()` method
- `backend/src/lib/memory/storage/memory-store.interface.ts` — add `listTags` to interface
- `backend/src/lib/memory/storage/postgres-memory-store.ts` — implement `listTags` query

### Dependencies

None added or removed.

### Patterns to follow

- `defineToolModule` / `defineTool` pattern from `../../types`
- Singleton service pattern (`MemoryService.getInstance()`)
- `userId` passed as method parameter

### Steps

1. Add `listTags(userId: string): Promise<Array<{ tag: string; count: number }>>` to `MemoryStore` interface
2. Implement in `postgres-memory-store.ts` — query distinct tags from `jsonb_array_elements_text(tags)` grouped with count, filtered to `status = 'active'`
3. Add `listTags()` method to `MemoryService` delegating to store
4. Add `list_tags` action to continuity tool — calls `service.listTags(userId)`, returns `{ tags: [...], total: N }`
5. Comment out `list` action block and remove `"list"` from the action enum and tool description
6. Delete `backend/src/lib/tools/modules/memory/` directory
7. Remove `memoryModule` import and export from `backend/src/lib/tools/modules/index.ts`

### Verification

- [ ] `list_tags` action returns distinct tags with counts for the user's active memories
- [ ] `list` action is commented out and not in the action enum
- [ ] `find` action works unchanged
- [ ] Obsidian `memory` module directory is deleted
- [ ] `memoryModule` removed from `allToolModules` in modules index
- [ ] `npm run build` in `backend/` succeeds with no type errors

## Alternatives Considered

* **Remove `list` entirely**: Rejected — the code may be useful for admin or debugging tools later. Commenting out is low-cost.
* **Add semantic/vector search instead of tags**: Over-engineering for now. Keyword `find` + tag browsing covers the current needs. Vector search can be a future ADR.
* **Keep the Obsidian module alongside**: Rejected — it's dead code with no active integration. ADR-0004 also proposes removal.
