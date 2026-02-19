---
status: "implemented"
date: 2026-02-19
decision-makers: "Kuba Szwajka"
---

# Adopt recursive sessions and unified agent execution

## Context and Problem Statement

Lucy had two separate execution paths sharing ~80% of their logic:

1. **`ChatService.executeTurn()`** — streaming, for user ↔ root agent
2. **`AgentExecutionService.executeSubAgent()`** — non-streaming loop, for agent ↔ agent

Sub-agents didn't get their own session — they hung off the parent's `sessionId` as flat agent records with a `parentId`. This made delegation conversations hard to query, display, and trace independently.

How should we unify execution and model agent-to-agent collaboration?

## Decision Drivers

* One execution path for all agent runs (streaming or not) reduces duplication and bugs
* A session is a container for collaboration between two parties — if user ↔ agent gets a session, so should agent ↔ agent
* Child sessions provide natural audit trails, queryable history, and clean data boundaries
* Frontend should be able to display delegation conversations as their own sessions

## Considered Options

* **Option A: Recursive sessions** — each delegation creates a child session; unify execution into `ChatService.runAgent()`
* **Option B: Keep flat agents, merge execution** — unify the code path but keep agents in one session with `parentId`
* **Option C: Status quo** — maintain two separate execution paths

## Decision Outcome

Chosen option: **Option A — Recursive sessions**, because it fully unifies execution, provides clean data boundaries per collaboration, and makes delegation conversations independently queryable and displayable.

### Consequences

* Good, because one execution path (`ChatService.runAgent()`) handles both streaming and non-streaming
* Good, because session list simplifies — filter `parentSessionId IS NULL` for top-level
* Good, because each delegation is a full session with its own items, no interleaving
* Good, because tracing maps 1:1 to a single collaboration (sessionId on traces)
* Bad, because every delegation creates a session — more DB records
* Neutral, because `AgentExecutionService` is eliminated — replaced by delegate tool functions calling `ChatService.runAgent()` directly

## Implementation Plan

Full spec: [`docs/specs/recursive-sessions-spec.md`](../specs/recursive-sessions-spec.md)

### Phase 1: Unified `ChatService.runAgent()`

* **`backend/src/lib/services/chat/chat.service.ts`**: Single `runAgent()` method with discriminated union on `streaming: true | false`. Shared logic: `prepareChat()`, system prompt building, step persistence, tracing, agent status updates. Branch: `streamText()` vs `generateText()` loop.
* **`backend/src/lib/services/chat/types.ts`**: `RunAgentOptions`, `RunAgentResult` types.

### Phase 2: Schema migration

* **`backend/src/lib/db/schema.ts`**: Add `parentSessionId` (FK → sessions) and `sourceCallId` to `sessions` table. Add index on `parentSessionId`. Remove `parentId` and `sourceCallId` from `agents` table.
* **`backend/src/types/index.ts`**: Update `Session`, `SessionCreate`, add `ChildSessionSummary` type.

### Phase 3: Delegate tools use child sessions

* **`backend/src/lib/tools/delegate/index.ts`**: `generateDelegateTools()` creates child sessions via `sessionService.create()` with `parentSessionId` + `sourceCallId`, then calls `chatService.runAgent()` non-streaming. Also provides `continue_session` tool.

### Phase 4: Session tree queries

* **`backend/src/lib/services/session/session.service.ts`**: `getChildSessions()`, `getWithAgents()` returns `childSessions` array.
* **`backend/src/lib/services/session/session.repository.ts`**: `findAll()` filters `WHERE parentSessionId IS NULL`. `findByParentSessionId()` for children.
* **`backend/src/app/api/sessions/[id]/route.ts`**: `GET` returns `SessionWithAgents` including `childSessions`.

### Phase 5: Frontend display

* **`desktop/renderer/src/components/chat/MessageList.tsx`**: `ChildSessionCard` component renders child sessions linked to their source tool calls.
* **`desktop/renderer/src/hooks/useAgentChat.ts`**: Exposes `childSessions` from `SessionWithAgents`.
* Session list sidebar only shows top-level sessions (backend filters).

### Verification

- [x] `ChatService.runAgent()` exists with streaming/non-streaming discriminated union
- [x] `sessions` table has `parentSessionId` (FK) and `sourceCallId` columns with index
- [x] `agents` table no longer has `parentId` or `sourceCallId`
- [x] Delegate tools create child sessions with `parentSessionId` and `sourceCallId`
- [x] `continue_session` tool validates parent relationship
- [x] `SessionRepository.findAll()` filters `WHERE parentSessionId IS NULL`
- [x] `GET /api/sessions/[id]` returns `childSessions` in response
- [x] Frontend displays child sessions alongside their source tool calls
- [x] Child sessions hidden from main session list

## More Information

* The original spec is at `docs/specs/recursive-sessions-spec.md`.
* All 5 phases were implemented incrementally. Phases 1-3 shipped together, phases 4-5 followed.
* If delegation sessions cause DB bloat, consider archival or cascade-delete policies on parent session deletion.
