---
status: "done"
date: 2026-02-19
decision-makers: "Kuba"
---

# Add system-initiated triggers (cron jobs and webhooks)

## Context and Problem Statement

Lucy supports two session initiator types: **user-initiated** (interactive chat via SSE) and **agent-initiated** (delegate tools creating child sessions with `generateText`). There is no way to run agents on a schedule or in response to external events.

Automation use cases require a third initiator type — **system-initiated** sessions — where a trigger (cron schedule or incoming webhook) creates a session and runs an agent non-streaming. Examples: daily briefings, webhook-driven PR reviews, IoT-triggered home automation.

How should we add scheduled and event-driven agent execution without introducing a new execution path?

## Decision Drivers

* Must reuse existing `SessionService.create()` + `ChatService.runAgent(streaming: false)` — no new execution engine
* Triggers are user-owned — each user has their own set of triggers, sessions run under the trigger owner's `userId`
* Agent autonomy comes from the agentConfig system prompt, not special message framing
* External-world events only (webhooks, cron) — no in-process event bus
* Rate limiting and cooldown to prevent runaway execution
* Audit trail for every trigger firing (success, failure, or skip)
* Cron must survive server restarts and not duplicate in multi-instance deployments

## Considered Options

* **In-process cron (`node-cron`)** — timers inside the Node.js process, zero dependencies
* **pg-boss (Postgres-backed job queue)** — durable scheduling via Postgres `SKIP LOCKED`
* **BullMQ (Redis-backed queue)** — battle-tested but adds Redis dependency

## Decision Outcome

Chosen option: **pg-boss**, because it provides durable, deduplicated cron scheduling using our existing Postgres — no new infrastructure. Jobs survive server restarts, `SKIP LOCKED` guarantees single-execution across multiple instances, and pg-boss has built-in cron support via `pg-boss.schedule()`.

### Consequences

* Good, because no new infrastructure — pg-boss uses existing Postgres, no Redis or external scheduler
* Good, because cron jobs are durable — survive server restarts, missed jobs are picked up on recovery
* Good, because `SKIP LOCKED` prevents duplicate execution across multiple instances
* Good, because execution path is identical to delegation (`generateText` loop), so ChatService is unchanged
* Good, because `triggerRuns` table provides full audit trail with status, result, error, and skip reasons
* Neutral, because pg-boss creates its own schema in Postgres (`pgboss.*` tables) — lightweight but worth knowing
* Neutral, because webhook auth uses a single shared `LUCY_API_KEY` — simple but no per-trigger isolation

## How It Works

### The Three Trigger Paths

```
User types message  →  SSE streaming   →  ChatService.executeTurn()
Agent delegates     →  non-streaming   →  ChatService.runAgent()
Trigger fires       →  non-streaming   →  ChatService.runAgent()  (same path as delegation)
```

### Cron Flow

```
Server starts
  → pg-boss.start()
  → Load all enabled cron triggers from DB
  → pg-boss.schedule(cronExpression) for each
  → pg-boss worker picks up jobs on schedule
  → TriggerService.execute(triggerId)
    → Rate limit + cooldown checks
    → SessionService.create(userId, { agentConfigId })
    → ChatService.runAgent(rootAgentId, userId, messages, { streaming: false, maxTurns })
    → Record result in triggerRuns
```

### Webhook Flow

```
External service POSTs to /api/triggers/webhook/:id
  → Validate LUCY_API_KEY Bearer token
  → Load trigger, check enabled
  → TriggerService.execute(triggerId, request.body)
    → Same execution as cron (rate limit, cooldown, create session, run agent)
    → Interpolate inputTemplate with webhook payload: {{payload.pr_url}} → actual value
    → Record result in triggerRuns
  → Return 200 with { runId, sessionId }
```

### User Ownership

Every trigger belongs to a user. When a trigger fires, the resulting session is created under that user's `userId`. The user sees trigger-created sessions in their session list alongside interactive ones. CRUD routes are JWT-protected and scoped to the authenticated user.

## Implementation Plan

Implemented in two phases. Phase 1 is the core; Phase 2 is frontend.

### Phase 1 — Schema + Service + CRUD API + Webhooks + Cron

* **Affected paths**:
  - `backend/src/lib/server/db/schema.ts` — add `triggers` and `triggerRuns` tables
  - `backend/src/lib/server/services/trigger/` — new directory: `TriggerRepository`, `TriggerService`, `TriggerScheduler`
  - `backend/src/app/api/triggers/` — CRUD routes (collection + `[id]`)
  - `backend/src/app/api/triggers/[id]/runs/` — run history route
  - `backend/src/app/api/triggers/[id]/test/` — manual fire route
  - `backend/src/app/api/triggers/webhook/[id]/` — webhook endpoint

* **Dependencies**: `pg-boss` (Postgres-backed job queue with cron support)

* **Patterns to follow**:
  - Singleton service: `TriggerService.getInstance()` (see `AgentConfigService`)
  - Repository pattern: `TriggerRepository` for all DB queries
  - Auth: `requireAuth(request)` on CRUD routes, `LUCY_API_KEY` Bearer check on webhook route
  - All queries scoped by `userId` (CRUD) or by trigger ID (webhook)
  - `TriggerScheduler` wraps pg-boss: `start()`, `syncTrigger(id)`, `removeTrigger(id)`, `stop()`

* **Patterns to avoid**:
  - Do not modify `ChatService` — triggers call existing `runAgent` path
  - Do not create a "system user" — triggers run under their owner's userId
  - Do not add complex template engines — flat `{{payload.field}}` interpolation only

* **Schema details**:
  - `triggers` table: `id`, `userId` (FK users), `name`, `description`, `agentConfigId` (FK agentConfigs), `triggerType` (cron|webhook), `cronExpression`, `timezone`, `inputTemplate`, `enabled`, `maxTurns`, `maxRunsPerHour`, `cooldownSeconds`, `lastTriggeredAt`, `lastRunSessionId` (FK sessions), `createdAt`, `updatedAt`
  - `triggerRuns` table: `id`, `triggerId` (FK triggers), `sessionId` (FK sessions, nullable), `status` (pending|running|completed|failed|skipped), `skipReason`, `result`, `error`, `eventPayload` (jsonb), `startedAt`, `completedAt`
  - Indexes: `(userId)`, `(userId, triggerType)` on triggers; `(triggerId)`, `(triggerId, status)` on triggerRuns

* **pg-boss integration** (`TriggerScheduler`):
  - On server startup: `pgBoss.start()` → load enabled cron triggers → `pgBoss.schedule(triggerName, cronExpression, data, { tz })` for each
  - Worker: `pgBoss.work(triggerName, handler)` — handler calls `TriggerService.execute()`
  - On trigger create/update: `pgBoss.unschedule(old)` + `pgBoss.schedule(new)` if cron type
  - On trigger delete: `pgBoss.unschedule(triggerName)`
  - On server shutdown: `pgBoss.stop()`

* **Execution flow** (`TriggerService.execute(triggerId, eventPayload?)`):
  1. Load trigger, validate enabled
  2. Rate limit check (`maxRunsPerHour`) — count recent triggerRuns, skip if exceeded
  3. Cooldown check (`cooldownSeconds`) — compare `lastTriggeredAt`, skip if within window
  4. Create triggerRun (status: pending)
  5. Interpolate `inputTemplate` with `eventPayload` (flat `{{payload.x}}` replacement)
  6. `SessionService.create(userId, { agentConfigId })`
  7. `ItemService.createMessage(rootAgentId, "user", resolvedInput)`
  8. `ChatService.runAgent(rootAgentId, userId, messages, { streaming: false, maxTurns })`
  9. Update triggerRun (completed + result) and trigger (lastTriggeredAt, lastRunSessionId)
  10. On error at any step: mark triggerRun as failed with error message

* **API routes**:
  - `POST /api/triggers` — create (JWT)
  - `GET /api/triggers` — list user's triggers (JWT)
  - `GET /api/triggers/:id` — get trigger + recent runs (JWT)
  - `PUT /api/triggers/:id` — update (JWT)
  - `DELETE /api/triggers/:id` — delete (JWT)
  - `GET /api/triggers/:id/runs` — paginated run history (JWT)
  - `POST /api/triggers/:id/test` — manually fire (JWT)
  - `POST /api/triggers/webhook/:id` — webhook entry (LUCY_API_KEY auth, returns 401/404/409 appropriately)

### Phase 2 — Frontend + Non-Streaming Fixes

* **Trigger management UI**: Settings > Triggers page with split-pane layout (list + editor), following AgentConfigs pattern
* **Editor fields**: name, description, trigger type (cron/webhook), cron expression + timezone (conditional), agent config select, input template, max turns, max runs/hour, cooldown, enabled toggle
* **Test button**: fires `POST /triggers/:id/test`, shows result inline
* **Run history**: last 10 runs with status badges, timestamps, result/error, and **stop button** for running executions
* **Run cancellation**: `POST /triggers/:id/runs/:runId/cancel` — AbortController registry in ChatService keyed by agentId, signal threaded into `generateText`, cancelled runs get `status: "cancelled"`
* **Dashboard crons section**: full-width dashboard with cron trigger cards (schedule in human-readable form via `cronstrue`, next fire time via `cron-parser`, agent config name, last run) and upcoming runs timeline
* **Sidebar**: "Triggers" nav item with clock icon between Agents group and MCP Servers

### Implementation Learnings

* **Non-streaming tool history bug**: `itemsToModelMessages()` only included `message` items, stripping `tool_call` and `tool_result`. This works for streaming (where `streamText` handles multi-step internally) but not for the non-streaming `generateText` loop where each turn is a separate API call. The agent saw only the original user message each turn, causing infinite tool-call loops. Fix: added `itemsToFullModelMessages()` that builds AI SDK format with `{ role: "assistant", content: [ToolCallPart] }` and `{ role: "tool", content: [ToolResultPart] }` messages.
* **Trace naming**: Trigger-created sessions had no title, making traces unidentifiable. Fix: set session title to `[Trigger] <name>` immediately after creation.
* **Thinking**: Explicitly pass `thinkingEnabled: true` to `runAgent` for trigger executions so they behave like regular conversations.

### Verification

- [ ] `triggers` and `triggerRuns` tables exist in schema and `db:push` succeeds
- [ ] pg-boss starts and connects to Postgres on server startup
- [ ] CRUD routes work: create, list, get, update, delete triggers (JWT auth, userId scoping)
- [ ] Creating a cron trigger registers it with pg-boss scheduler
- [ ] Deleting/disabling a cron trigger removes it from pg-boss scheduler
- [ ] Cron trigger fires on schedule and creates a session + triggerRun
- [ ] Cron trigger survives server restart (re-registered on startup)
- [ ] `POST /api/triggers/:id/test` creates a session and runs the agent to completion
- [ ] `POST /api/triggers/webhook/:id` returns 401 without valid `LUCY_API_KEY`
- [ ] `POST /api/triggers/webhook/:id` with valid key creates session + triggerRun
- [ ] Rate limiting: trigger with `maxRunsPerHour=1` skips second run within the hour, triggerRun has status `skipped` with reason
- [ ] Cooldown: trigger with `cooldownSeconds=60` skips if fired within 60s of last run
- [ ] Input template interpolation: `{{payload.url}}` replaced with webhook body field
- [ ] triggerRuns audit log shows correct status progression (pending → running → completed/failed/skipped)
- [ ] Disabled triggers return 409 on webhook and are not executed

## More Information

* The three session initiator types after this ADR: User (SSE streaming), Agent (delegation, non-streaming), System (triggers, non-streaming)
* pg-boss docs: https://github.com/timgit/pg-boss
* Revisit this decision if: per-trigger webhook secrets are needed for security, or Redis is added for other reasons (could then consider BullMQ)
