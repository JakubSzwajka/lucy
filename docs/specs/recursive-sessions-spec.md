# Spec: Recursive Sessions & Unified Agent Execution

## Problem

Today we have two separate execution paths:

1. **`ChatService.executeTurn()`** — streaming, for user ↔ root agent
2. **`AgentExecutionService.executeSubAgent()`** — non-streaming loop, for agent ↔ agent

They share ~80% of their logic (prepareChat, message building, step persistence, tracing, finalization) but are maintained separately. Sub-agents don't get their own session — they hang off the parent's `sessionId` as flat agent records with a `parentId`.

## Insight

A session is a container for collaboration between two parties. If user ↔ agent gets a session, so should agent ↔ agent. This makes the model recursive and lets us unify the execution path.

## Target Model

```
Session (user ↔ root agent)
  └── Session (root agent ↔ delegate agent)
        └── Session (delegate ↔ sub-delegate)   ← recursive
```

Each delegation creates a **child session** with its own root agent. The execution logic is the same `ChatService.runAgent()` — the only branch is streaming vs non-streaming.

## Data Model Changes

### `sessions` table — add:

| Column | Type | Description |
|--------|------|-------------|
| `parentSessionId` | text, nullable, FK → sessions | Links child session to parent |
| `sourceCallId` | text, nullable | The tool_call that spawned this session |

### `agents` table — remove:

| Column | Reason |
|--------|--------|
| `parentId` | Replaced by session hierarchy (`session.parentSessionId`) |
| `sourceCallId` | Moved to sessions table |

Each session still has exactly one `rootAgentId`. The agent tree becomes a session tree.

### Migration

```
agents.parentId        → sessions.parentSessionId (lookup via agent.sessionId)
agents.sourceCallId    → sessions.sourceCallId
```

## Service Changes

### Phase 1: Unified `ChatService.runAgent()`

Merge `executeTurn` and the sub-agent generate loop into one method:

```typescript
async runAgent(
  agentId: string,
  userId: string,
  message: string,
  options: RunAgentOptions
): Promise<RunAgentResult>

type RunAgentOptions = {
  sessionId: string;
  modelId?: string;
  thinkingEnabled?: boolean;
} & (
  | { streaming: true }                          // → returns SSE stream
  | { streaming: false; maxTurns?: number }       // → returns final text
)

type RunAgentResult =
  | { stream: StreamTextResult }                  // streaming mode
  | { result: string; reachedMaxTurns: boolean }  // non-streaming mode
```

**Shared logic** (both modes):
- `prepareChat()` — context, tools, system prompt, memory, env
- `prependSystemPrompt()` — message building
- Step persistence (tool calls, tool results, assistant text)
- Agent status updates (running → waiting/completed)
- Tracing (Langfuse observation wrapping)

**Branch point:**
- `streaming: true` → `streamText()` with `stepCountIs(10)`, return stream
- `streaming: false` → `generateText()` loop up to `maxTurns`, return text

### Phase 2: Schema migration

1. Add `parentSessionId` and `sourceCallId` to `sessions` table
2. Migrate existing data: for each agent with `parentId`, look up its session, create the FK
3. Drop `parentId` and `sourceCallId` from `agents` table
4. Add index on `sessions.parentSessionId`

### Phase 3: Delegate tools use child sessions

Update `AgentExecutionService` (now thin wrapper):

```typescript
async executeSubAgent(parentAgentId, sessionId, userId, agentConfigId, task, sourceCallId) {
  // 1. Create child session (with parentSessionId + sourceCallId)
  const childSession = await sessionService.create({
    title: task.slice(0, 80),
    agentConfigId,
    parentSessionId: sessionId,
    sourceCallId,
  }, userId);

  // 2. Run agent (non-streaming)
  const chatService = getChatService();
  return chatService.runAgent(childSession.rootAgentId, userId, task, {
    sessionId: childSession.id,
    streaming: false,
    maxTurns: agentConfig?.maxTurns,
  });
}
```

`continueSubAgent` becomes:
```typescript
async continueSubAgent(childSessionId, parentSessionId, userId, message) {
  const session = await sessionService.getById(childSessionId, userId);
  if (session.parentSessionId !== parentSessionId) throw Error("not a child");

  return chatService.runAgent(session.rootAgentId, userId, message, {
    sessionId: childSessionId,
    streaming: false,
  });
}
```

### Phase 4: Session tree queries

Update `SessionService` and API:

- `getChildSessions(sessionId, userId)` — direct children
- `GET /api/sessions/[id]` response includes `childSessions` (or just IDs)
- Frontend can display delegation tree (each child session is a full conversation)
- `AgentService.getTreeBySessionId()` simplifies — no more tree building from flat agent list, each session has one root agent

### Phase 5: Frontend — display child sessions

- Sub-agent conversations become viewable as their own sessions
- Parent session shows delegation tool calls with links to child sessions
- Child sessions hidden from main session list by default (filter `parentSessionId IS NULL`)

## What Gets Deleted

- `AgentExecutionService` execute/continue loops (~200 lines) — replaced by `ChatService.runAgent()`
- `AgentService.buildAgentTree()` — replaced by session tree
- Duplicate step persistence logic in agent-execution.service.ts
- `agents.parentId` and `agents.sourceCallId` columns

## What Gets Simpler

- **One execution path** for all agent runs (streaming or not)
- **Session list** — filter `parentSessionId IS NULL` for top-level, no agent tree building
- **Conversation history** — each session/agent pair has its own items, no interleaving
- **Tracing** — sessionId on traces maps 1:1 to a single collaboration
- **Future capabilities** — agents can create sessions for any purpose (research, planning, sub-tasks) using the same mechanism

## Risks & Edge Cases

1. **More sessions in DB** — every delegation creates a session. Could add up. Mitigation: cascade delete from parent, archive with parent.
2. **`continue_agent` tool** — currently references `agentId` directly. Needs to reference `childSessionId` instead. The delegate tool response should include the child session ID.
3. **Existing data migration** — agents with `parentId` need their sessions retroactively created. Or: skip migration, only new delegations use the new model (agents without parentId still work as before).
4. **Session title** — auto-generated from task text for child sessions, not from AI title generation.
5. **Frontend session list** — must filter out child sessions. Default query becomes `WHERE parentSessionId IS NULL`.

## Phase Order & Dependencies

```
Phase 1: ChatService.runAgent()          ← No schema changes, pure refactor
Phase 2: Schema migration                ← Add parentSessionId to sessions
Phase 3: Delegate tools use child sessions ← Wires Phase 1 + 2 together
Phase 4: Session tree queries            ← API + service layer
Phase 5: Frontend display                ← UI for viewing delegation trees
```

Phase 1 can ship independently as a pure refactor. Phases 2-3 ship together. Phases 4-5 are incremental.
