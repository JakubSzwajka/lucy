# Triggers — Cron Jobs & Event-Driven Agent Sessions

## Overview

Triggers allow **system-initiated** agent sessions — no human in the loop. A trigger defines **when** to run (cron schedule or event match), **which agent** to run (agentConfigId), and **what task** to give it (input template).

This completes the three session initiator types:

| Initiator | Entry point | Streaming | Example |
|-----------|------------|-----------|---------|
| **User** | `POST /api/sessions/[id]/chat` | Yes (SSE) | Interactive chat |
| **Agent** | Delegate tools (child session) | No (`generateText` loop) | Sub-agent delegation |
| **System** | `TriggerService.execute()` | No (`generateText` loop) | Cron jobs, webhooks, internal events |

System-initiated sessions reuse the existing `SessionService.create()` + `ChatService.runAgent(streaming: false)` path — the same one delegation already uses.

## Design Principles

- **No new execution path.** Triggers create a session and call `runAgent` non-streaming. ChatService is unchanged.
- **Agent autonomy via system prompt, not message framing.** The trigger's input template is sent as `role: "user"` (model API requirement), but the agent knows it's autonomous because its agentConfig system prompt says so. The trigger itself is dumb: config + input + schedule.
- **User-owned.** Triggers belong to a user. Sessions they create run under that user's userId. No "system user" needed.
- **Dedicated agentConfigs for automation.** Autonomous agents should have system prompts like: "You are running autonomously. No human in the loop. Do not ask clarifying questions — make decisions and execute."

## Schema

### `triggers` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | UUID |
| `userId` | text FK → users | Owner |
| `name` | text | Display name |
| `description` | text | Optional description |
| `agentConfigId` | text FK → agentConfigs | Which agent config to use |
| `triggerType` | enum `"cron" \| "event"` | Scheduling mechanism |
| `cronExpression` | text (nullable) | Cron syntax, e.g. `"0 9 * * *"` |
| `timezone` | text (nullable) | IANA timezone, e.g. `"Europe/Warsaw"` |
| `eventType` | text (nullable) | Event name to match: `"session_completed"`, `"webhook"`, `"memory_created"` |
| `eventFilter` | jsonb (nullable) | Conditions to match against event payload |
| `inputTemplate` | text | Task instruction sent to the agent |
| `enabled` | boolean | Whether this trigger is active |
| `maxTurns` | integer (nullable) | Override agentConfig.maxTurns |
| `lastTriggeredAt` | timestamp (nullable) | When it last fired |
| `lastRunSessionId` | text FK → sessions (nullable) | Most recent session created |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Indexes: `(userId)`, `(userId, triggerType)`, `(eventType)` for event dispatch lookup.

### `triggerRuns` table (audit log)

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | UUID |
| `triggerId` | text FK → triggers | Which trigger fired |
| `sessionId` | text FK → sessions (nullable) | Session created for this run |
| `status` | enum `"pending" \| "running" \| "completed" \| "failed"` | Run status |
| `result` | text (nullable) | Agent's final output |
| `error` | text (nullable) | Error message if failed |
| `eventPayload` | jsonb (nullable) | Event data that triggered this run (for events) |
| `startedAt` | timestamp | |
| `completedAt` | timestamp (nullable) | |

Indexes: `(triggerId)`, `(triggerId, status)`.

## Execution Flow

```
Trigger fires (cron tick or event match)
  │
  ▼
TriggerService.execute(triggerId, eventPayload?)
  │
  ├─ 1. Load trigger, validate enabled
  ├─ 2. Create triggerRun record (status: "pending")
  ├─ 3. Resolve inputTemplate (interpolate eventPayload if present)
  ├─ 4. SessionService.create(userId, { agentConfigId })
  ├─ 5. ItemService.createMessage(rootAgentId, "user", resolvedInput)
  ├─ 6. ChatService.runAgent(rootAgentId, userId, messages, { streaming: false, maxTurns })
  ├─ 7. Update triggerRun (status: "completed", result)
  └─ 8. Update trigger (lastTriggeredAt, lastRunSessionId)
```

On error at any step, triggerRun is marked `"failed"` with the error message.

## Input Template Interpolation

For event-triggered runs, the `inputTemplate` can reference event payload fields using `{{payload.field}}` syntax:

```
# Cron trigger (no interpolation needed):
"Summarize my Todoist tasks for today"

# Webhook trigger:
"Review this PR: {{payload.url}}"

# session_completed event:
"Extract memories from session {{payload.sessionId}}"
```

Keep interpolation simple — flat field access only, no expressions. If the template references a missing field, leave it as-is (fail visibly in the prompt, let the agent handle it).

## Cron Scheduling

**Phase 1: In-process scheduling (single server)**

Use `node-cron` or similar. On server startup:
1. Load all enabled triggers where `triggerType = "cron"`
2. Register each with the cron library
3. On trigger fire → `TriggerService.execute(triggerId)`

On trigger create/update/delete, update the in-process scheduler.

**Phase 2 (future): External scheduler**

When running multiple backend instances, move to pg-boss or BullMQ to avoid duplicate execution. The `TriggerService.execute()` interface stays the same.

## Event Dispatch

A lightweight in-process event bus:

```typescript
// EventBus — singleton
class EventBus {
  emit(eventType: string, payload: Record<string, unknown>, userId: string): void
  // Looks up enabled triggers matching (userId, eventType, eventFilter)
  // Calls TriggerService.execute() for each match
}
```

### Initial event types

| Event | Emitted by | Payload |
|-------|-----------|---------|
| `session_completed` | `ChatService.finalizeChat()` | `{ sessionId, agentId, result }` |
| `webhook` | `POST /api/triggers/webhook/:id` | Request body |
| `memory_created` | Memory extraction pipeline | `{ memoryId, type, content }` |

New event types can be added by placing `eventBus.emit(...)` calls at the right points. No registration needed.

### Event filter matching

`eventFilter` is a JSON object of key-value pairs. All must match against the event payload (AND logic):

```json
// Trigger only when a "researcher" agent completes:
{ "agentConfigName": "researcher" }

// Trigger on any session completion:
null
```

Keep it simple — flat equality checks. No nested conditions, no OR logic. If more complex filtering is needed later, evaluate then.

## API Routes

```
POST   /api/triggers              — create trigger
GET    /api/triggers              — list user's triggers
GET    /api/triggers/:id          — get trigger + recent runs
PUT    /api/triggers/:id          — update trigger
DELETE /api/triggers/:id          — delete trigger
GET    /api/triggers/:id/runs     — list run history (paginated)
POST   /api/triggers/:id/test     — manually fire trigger (for testing)
POST   /api/triggers/webhook/:id  — webhook endpoint
```

All routes require auth except webhook (which validates the trigger exists and is enabled).

## Example Configurations

### Daily briefing (cron)

```json
{
  "name": "Morning Briefing",
  "triggerType": "cron",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "Europe/Warsaw",
  "agentConfigId": "<briefing-agent-config>",
  "inputTemplate": "Generate my morning briefing: check calendar, summarize pending tasks, highlight anything urgent."
}
```

### Auto-reflection on session end (event)

```json
{
  "name": "Session Reflection",
  "triggerType": "event",
  "eventType": "session_completed",
  "eventFilter": null,
  "agentConfigId": "<reflector-agent-config>",
  "inputTemplate": "Extract memories and insights from session {{payload.sessionId}}."
}
```

### PR review via webhook (event)

```json
{
  "name": "PR Review",
  "triggerType": "event",
  "eventType": "webhook",
  "agentConfigId": "<code-reviewer-config>",
  "inputTemplate": "Review this pull request: {{payload.pull_request.html_url}}. Focus on correctness and security."
}
```

## Implementation Phases

### Phase 1 — Schema + Service + CRUD API
- Add `triggers` and `triggerRuns` tables to schema
- `TriggerRepository` + `TriggerService` (singleton pattern)
- CRUD API routes with auth
- `TriggerService.execute()` — the core: create session → run agent → record result
- Manual test endpoint (`POST /api/triggers/:id/test`)

### Phase 2 — Cron Scheduling
- In-process cron scheduler (start on server boot)
- Register/unregister on trigger create/update/delete
- Graceful shutdown

### Phase 3 — Event Bus + Dispatch
- `EventBus` singleton with `emit()`
- Wire `session_completed` event into `ChatService.finalizeChat()`
- Webhook API route
- Event filter matching logic

### Phase 4 — Frontend
- Trigger management UI (create/edit/list/delete)
- Run history view
- Test trigger button
