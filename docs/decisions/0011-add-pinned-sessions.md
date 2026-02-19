---
status: proposed
date: 2026-02-19
decision-makers: "Kuba Szwajka"
---

# Add pinned/favorite sessions to sidebar

## Context and Problem Statement

Sessions in the sidebar are sorted by `updatedAt` descending — most recently active first. Important or frequently referenced sessions get buried as new conversations push them down. There is no way to keep specific sessions easily accessible regardless of age.

## Decision

Add a boolean `isPinned` column to the `sessions` table. Pinned sessions sort to the top of the sidebar, above unpinned sessions. Within each group (pinned / unpinned), sessions remain sorted by `updatedAt` descending.

## Implementation Plan

### 1. Schema + Types

**`backend/src/lib/db/schema.ts`** — add to sessions table:
```typescript
isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
```

**`backend/src/types/index.ts`** + **`desktop/renderer/src/types/index.ts`** — add to `Session` interface:
```typescript
isPinned: boolean;
```
Add to `SessionUpdate`:
```typescript
isPinned?: boolean;
```

### 2. Backend Repository + Service

**`backend/src/lib/services/session/session.repository.ts`**:
- Change `findAll()` sort from `orderBy(desc(sessions.updatedAt))` to `orderBy(desc(sessions.isPinned), desc(sessions.updatedAt))`
- Ensure `update()` method passes `isPinned` through when present in update data

**`backend/src/lib/services/session/session.service.ts`**:
- No new methods needed — existing `update(id, userId, data)` handles it since `SessionUpdate` will include `isPinned`

### 3. API

No new routes needed. The existing `PATCH /api/sessions/[id]` route already calls `sessionService.update()` with the request body. Adding `isPinned` to `SessionUpdate` is sufficient.

### 4. Frontend Hook

**`desktop/renderer/src/hooks/useSessions.ts`**:
- Add a `pinSession(id: string, isPinned: boolean)` helper that calls `PATCH /api/sessions/{id}` with `{ isPinned }` and invalidates the sessions query cache

### 5. Frontend UI

**`desktop/renderer/src/components/sidebar/SessionItem.tsx`**:
- Add a pin/unpin button (appears on hover, similar to existing delete button)
- Show a pin indicator icon when `session.isPinned` is true

**`desktop/renderer/src/components/sidebar/Sidebar.tsx`**:
- Pass `onPinSession` callback to `SessionItem`
- Optionally render a visual separator between pinned and unpinned groups

### Affected paths
- `backend/src/lib/db/schema.ts`
- `backend/src/types/index.ts`
- `desktop/renderer/src/types/index.ts`
- `backend/src/lib/services/session/session.repository.ts`
- `desktop/renderer/src/hooks/useSessions.ts`
- `desktop/renderer/src/components/sidebar/SessionItem.tsx`
- `desktop/renderer/src/components/sidebar/Sidebar.tsx`

## Non-goals

- Custom ordering of pinned sessions (manual drag-to-reorder)
- Folders or categories for sessions
- Limit on number of pinned sessions
- Pinned sessions as a separate sidebar section with its own scroll

## Verification

- [ ] Pinning a session moves it to the top of the sidebar
- [ ] Unpinning moves it back to its chronological position
- [ ] Pinned sessions remain at top even after creating new sessions
- [ ] Pin state persists across page refreshes
- [ ] Multiple sessions can be pinned simultaneously
- [ ] Pin/unpin button visible on hover in sidebar

## Consequences

- Adds one boolean column to sessions — negligible storage/query cost
- Sort uses two fields instead of one — no index needed at current scale
- If pinned count grows large, may want a visual separator or collapsible group (future enhancement)
