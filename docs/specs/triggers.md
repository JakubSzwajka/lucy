# Triggers — Cron Jobs & Webhook-Driven Agent Sessions

## Overview

Triggers allow **system-initiated** agent sessions — no human in the loop. A trigger defines **when** to run (cron schedule or webhook), **which agent** to run (agentConfigId), and **what task** to give it (input template).

This completes the three session initiator types:

| Initiator | Entry point | Streaming | Example |
|-----------|------------|-----------|---------|
| **User** | `POST /api/sessions/[id]/chat` | Yes (SSE) | Interactive chat |
| **Agent** | Delegate tools (child session) | No (`generateText` loop) | Sub-agent delegation |
| **System** | `TriggerService.execute()` | No (`generateText` loop) | Cron jobs, webhooks |

System-initiated sessions reuse the existing `SessionService.create()` + `ChatService.runAgent(streaming: false)` path — the same one delegation already uses.

## Design Principles

- **No new execution path.** Triggers create a session and call `runAgent` non-streaming. ChatService is unchanged.
- **Agent autonomy via system prompt, not message framing.** The trigger's input template is sent as `role: "user"` (model API requirement), but the agent knows it's autonomous because its agentConfig system prompt says so. The trigger itself is dumb: config + input + schedule.
- **User-owned.** Triggers belong to a user. Sessions they create run under that user's userId. No "system user" needed.
- **Dedicated agentConfigs for automation.** Autonomous agents should have system prompts like: "You are running autonomously. No human in the loop. Do not ask clarifying questions — make decisions and execute."
- **External-world events only.** Events come from the external world (webhooks, IoT, automations) — not from internal app events. No in-process event bus.

## Schema

### `triggers` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | UUID |
| `userId` | text FK → users | Owner |
| `name` | text | Display name |
| `description` | text | Optional description |
| `agentConfigId` | text FK → agentConfigs | Which agent config to use |
| `triggerType` | enum `"cron" \| "webhook"` | Scheduling mechanism |
| `cronExpression` | text (nullable) | Cron syntax, e.g. `"0 9 * * *"` |
| `timezone` | text (nullable) | IANA timezone, e.g. `"Europe/Warsaw"` |
| `inputTemplate` | text | Task instruction sent to the agent |
| `enabled` | boolean | Whether this trigger is active |
| `maxTurns` | integer (nullable) | Override agentConfig.maxTurns |
| `maxRunsPerHour` | integer (nullable) | Maximum times this trigger can fire per hour. If exceeded, run is skipped. |
| `cooldownSeconds` | integer (nullable) | Minimum seconds between consecutive runs. If fired within cooldown window, run is skipped. |
| `lastTriggeredAt` | timestamp (nullable) | When it last fired |
| `lastRunSessionId` | text FK → sessions (nullable) | Most recent session created |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Indexes: `(userId)`, `(userId, triggerType)`.

### `triggerRuns` table (audit log)

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | UUID |
| `triggerId` | text FK → triggers | Which trigger fired |
| `sessionId` | text FK → sessions (nullable) | Session created for this run |
| `status` | enum `"pending" \| "running" \| "completed" \| "failed" \| "skipped"` | Run status |
| `skipReason` | text (nullable) | Why the run was skipped (e.g. "rate limit exceeded", "cooldown active") |
| `result` | text (nullable) | Agent's final output |
| `error` | text (nullable) | Error message if failed |
| `eventPayload` | jsonb (nullable) | Webhook request body that triggered this run |
| `startedAt` | timestamp | |
| `completedAt` | timestamp (nullable) | |

Indexes: `(triggerId)`, `(triggerId, status)`.

## Execution Flow

```
Trigger fires (cron tick or webhook request)
  │
  ▼
TriggerService.execute(triggerId, eventPayload?)
  │
  ├─ 1. Load trigger, validate enabled
  ├─ 2. Rate limit / cooldown check:
  │     a. If maxRunsPerHour is set, count triggerRuns for this trigger
  │        in the last hour. If >= max, create triggerRun with status
  │        "skipped" and skipReason "rate limit exceeded: {count}/{max}
  │        runs in the last hour", then return.
  │     b. If cooldownSeconds is set, check lastTriggeredAt. If less
  │        than cooldownSeconds ago, create triggerRun with status
  │        "skipped" and skipReason "cooldown active: {remaining}s
  │        remaining of {cooldown}s cooldown", then return.
  ├─ 3. Create triggerRun record (status: "pending")
  ├─ 4. Resolve inputTemplate (interpolate eventPayload if present)
  ├─ 5. SessionService.create(userId, { agentConfigId })
  ├─ 6. ItemService.createMessage(rootAgentId, "user", resolvedInput)
  ├─ 7. ChatService.runAgent(rootAgentId, userId, messages, { streaming: false, maxTurns })
  ├─ 8. Update triggerRun (status: "completed", result)
  └─ 9. Update trigger (lastTriggeredAt, lastRunSessionId)
```

On error at any step, triggerRun is marked `"failed"` with the error message.

## Input Template Interpolation

For webhook-triggered runs, the `inputTemplate` can reference event payload fields using `{{payload.field}}` syntax:

```
# Cron trigger (no interpolation needed):
"Summarize my Todoist tasks for today"

# Webhook trigger:
"Review this PR: {{payload.url}}"
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

## Webhook Handling

Webhooks arrive via `POST /api/triggers/webhook/:id`. The route:

1. Validates `Authorization: Bearer <LUCY_API_KEY>` header. If missing or mismatched, return 401.
2. Loads the trigger by ID. If not found, return 404. If not enabled, return 409.
3. Calls `TriggerService.execute(triggerId, request.body)`.

`LUCY_API_KEY` is an existing env var / app config. No per-trigger secrets, no HMAC — one key authenticates all webhook calls.

## API Routes

```
POST   /api/triggers              — create trigger          (JWT auth)
GET    /api/triggers              — list user's triggers     (JWT auth)
GET    /api/triggers/:id          — get trigger + recent runs (JWT auth)
PUT    /api/triggers/:id          — update trigger           (JWT auth)
DELETE /api/triggers/:id          — delete trigger           (JWT auth)
GET    /api/triggers/:id/runs     — list run history         (JWT auth, paginated)
POST   /api/triggers/:id/test     — manually fire trigger    (JWT auth)
POST   /api/triggers/webhook/:id  — webhook endpoint         (LUCY_API_KEY auth)
```

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

### Home arrival webhook

```json
{
  "name": "Kuba Got Home",
  "triggerType": "webhook",
  "agentConfigId": "<home-arrival-agent-config>",
  "inputTemplate": "Kuba just got home. Prepare an evening briefing: summarize what happened today, any pending tasks, and anything urgent for tomorrow."
}
```

### PR review via webhook

```json
{
  "name": "PR Review",
  "triggerType": "webhook",
  "agentConfigId": "<code-reviewer-config>",
  "inputTemplate": "Review this pull request: {{payload.pull_request.html_url}}. Focus on correctness and security."
}
```

## Implementation Phases

### Phase 1 — Schema + Service + CRUD API + Webhooks
- Add `triggers` and `triggerRuns` tables to schema
- `TriggerRepository` + `TriggerService` (singleton pattern)
- CRUD API routes with JWT auth
- `TriggerService.execute()` — the core: rate limit check → create session → run agent → record result
- Manual test endpoint (`POST /api/triggers/:id/test`)
- Webhook route (`POST /api/triggers/webhook/:id`) with `LUCY_API_KEY` auth

### Phase 2 — Cron Scheduling
- In-process cron scheduler (start on server boot)
- Register/unregister on trigger create/update/delete
- Graceful shutdown

### Phase 3 — Frontend
- Trigger management UI (create/edit/list/delete)
- Run history view
- Test trigger button
