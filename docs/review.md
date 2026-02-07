# Architecture Review

Issues and refactoring plans found while reviewing the system call map.

---

## Concepts

| Concept | What it is | DB entity | Lifecycle |
|---------|-----------|-----------|-----------|
| **Session** | User-facing conversation container. What appears in the sidebar. | `sessions` table | Created by user, archived/deleted |
| **Agent** | The AI participant. Has model, system prompt, tools, message history. | `agents` table | Auto-created with session (root), or spawned by tool calls (child) |
| **Turn** | One cycle: user says something → agent processes → agent responds. | No entity (implicit) | Triggered by user message or event |
| **Items** | The message history. Polymorphic: messages, tool calls, results, reasoning. | `items` table | Created during turns |
| **Plan** | Execution plan for complex tasks. Scoped to a session. | `plans` + `planSteps` | Created/updated by agent via tools |

**Relationships:**
```
Session (what the user sees)
  ├── Agent (the AI brain, root + children)
  │     └── Items (message history per agent)
  └── Plan (optional, one per session)
        └── PlanSteps
```

---

## 1. ChatService should own the full turn

### Problem

The chat route (`/api/sessions/[id]/chat/route.ts`) is doing orchestration that belongs in a service. It calls 4 different services and `streamText()` directly. This locks the turn logic to HTTP — if we need to trigger a turn from an event, sub-agent spawn, or cron job, we'd have to duplicate ~40 lines of glue code.

### Current flow (route as orchestrator)

```
Route:
  1. SessionService.getById(sessionId)          → resolve rootAgentId
  2. ItemService.createMessage(rootAgentId, msg) → persist user message
  3. SessionService.maybeGenerateTitle()         → auto-title from first msg
  4. ChatService.prepareChat(rootAgentId, opts)  → build AI context
  5. ChatService.convertToModelMessages()        → format messages
  6. ChatService.prependSystemPrompt()           → inject system prompt
  7. streamText({ onStepFinish, onFinish })      → call LLM
  8. persistStepContent()                        → save streaming steps
  9. ChatService.finalizeChat()                  → update agent status
```

ChatService only does steps 4-6 and 9 — the bookends. The route owns the actual interaction.

### Target flow (ChatService as orchestrator)

```
Route (thin HTTP adapter):
  1. Parse request
  2. chatService.executeTurn(sessionId, messages, options) → stream result
  3. Return stream as SSE response

ChatService.executeTurn():
  1. SessionService.getById(sessionId)          → resolve rootAgentId
  2. ItemService.createMessage(rootAgentId, msg) → persist user message
  3. SessionService.maybeGenerateTitle()         → auto-title
  4. this.prepareChat(rootAgentId, opts)         → build AI context (existing)
  5. this.convertToModelMessages()               → format messages (existing)
  6. this.prependSystemPrompt()                  → inject system prompt (existing)
  7. streamText({ onStepFinish, onFinish })      → call LLM
       onStepFinish → persistStepContent()       → save streaming steps
       onFinish → this.finalizeChat()            → update agent status
  8. Return streamText result
```

### ChatService dependency graph after refactor

```
ChatService (turn orchestrator)
  ├── SessionService     → resolve session, auto-title, touch timestamp
  ├── AgentService       → get agent, update status (existing)
  ├── ItemService        → persist user message (new)
  ├── StepPersistence    → persist streaming steps (new, moved from route)
  ├── ToolRegistry       → build tool set (existing)
  └── AI Providers       → getLanguageModel (existing)
```

### Additional cleanup in ChatService

- `touchSession()` currently bypasses SessionService and hits DB directly → use `SessionService.touch()` instead
- `getDefaultSystemPrompt()` currently queries DB directly → could use SystemPromptService/SettingsService, but this is lower priority

### Implementation

**File: `renderer/src/lib/services/chat/chat.service.ts`**
- Add `executeTurn(sessionId, messages, options)` method that returns a `streamText` result
- Import and use `getSessionService`, `getItemService`, `persistStepContent`
- Move all orchestration logic from the route into this method
- Replace `touchSession()` direct DB call with `SessionService.touch()`

**File: `renderer/src/app/api/sessions/[id]/chat/route.ts`**
- Reduce to ~10 lines: parse request → `chatService.executeTurn()` → return SSE response
- Remove all direct service imports except `getChatService`

**File: `renderer/src/lib/services/chat/types.ts`**
- Add `ExecuteTurnOptions` type: `{ modelId?, thinkingEnabled? }`
- Add return type if needed (or just return the AI SDK StreamTextResult)

---

## 2. Plans route should be nested under sessions

### Problem

`GET /api/plans?sessionId=xxx` — plans are always scoped to a session but use a query param instead of URL hierarchy. Inconsistent with `/api/sessions/[id]/chat`.

### Target

`GET /api/sessions/[id]/plans`

### Implementation

**Move: `renderer/src/app/api/plans/route.ts` → `renderer/src/app/api/sessions/[id]/plans/route.ts`**
- Extract `sessionId` from route params instead of query params
- Keep calling PlanService directly (same pattern as chat route calling ChatService)

**Update: `renderer/src/hooks/usePlan.ts`**
- Change fetch URL: `/api/plans?sessionId=${sessionId}` → `/api/sessions/${sessionId}/plans`

**Delete: `renderer/src/app/api/plans/` directory** (after move)

---

## 3. Update system call map diagram

After issues 1 and 2 are implemented, update the mermaid diagrams in `README.md` to reflect:
- ChatService as the orchestrator (route → ChatService → everything else)
- Plans route nested under sessions
- Remove direct route → SessionService/ItemService/StepPersist arrows
- ChatRoute connects only to ChatService
- ChatService connects to SessionSvc, AgentSvc, ItemSvc, StepPersist, ToolReg, Providers

---

## Execution order

1. **ChatService refactor** (issue 1) — the main structural change
2. **Plans route move** (issue 2) — independent, can run in parallel with #1
3. **Diagram update** (issue 3) — depends on #1 and #2 being done
