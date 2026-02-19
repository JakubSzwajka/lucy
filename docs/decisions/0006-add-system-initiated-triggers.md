---
status: "proposed"
date: 2026-02-19
decision-makers: "Kuba"
---

# Add system-initiated triggers (cron jobs and webhooks)

## Context and Problem Statement

Lucy supports two session initiator types: **user-initiated** (interactive chat via SSE) and **agent-initiated** (delegate tools creating child sessions with `generateText`). There is no way to run agents on a schedule or in response to external events.

Automation use cases require a third initiator type — **system-initiated** sessions — where a trigger (cron schedule or incoming webhook) creates a session and runs an agent non-streaming. Examples: daily briefings, webhook-driven PR reviews, IoT-triggered home automation.

How should we add scheduled and event-driven agent execution without introducing a new execution path?

See: [docs/specs/triggers.md](../specs/triggers.md) for the full specification.

## Decision Drivers

* Must reuse existing `SessionService.create()` + `ChatService.runAgent(streaming: false)` — no new execution engine
* Triggers are user-owned (sessions run under the trigger owner's `userId`)
* Agent autonomy comes from the agentConfig system prompt, not special message framing
* External-world events only (webhooks, cron) — no in-process event bus
* Rate limiting and cooldown to prevent runaway execution
* Audit trail for every trigger firing (success, failure, or skip)

## Considered Options

* **First-class trigger entity with in-process cron** — new `triggers` + `triggerRuns` tables, `node-cron` for scheduling, webhook endpoint with API key auth
* **External job scheduler (pg-boss / BullMQ)** — durable queue with at-least-once semantics

## Decision Outcome

Chosen option: **First-class trigger entity with in-process cron**, because it adds zero infrastructure dependencies, reuses the existing non-streaming execution path, and is sufficient for single-server deployment. The `TriggerService.execute()` interface is scheduler-agnostic, so migrating to an external scheduler later requires no changes to execution logic.

### Consequences

* Good, because no new infrastructure — works with current SQLite dev setup and single-server prod
* Good, because execution path is identical to delegation (`generateText` loop), so ChatService is unchanged
* Good, because `triggerRuns` table provides full audit trail with status, result, error, and skip reasons
* Bad, because in-process cron does not survive server restarts gracefully (missed ticks are lost)
* Bad, because multi-instance deployment will cause duplicate cron execution (addressed in future Phase 2)
* Neutral, because webhook auth uses a single shared `LUCY_API_KEY` — simple but no per-trigger isolation

## Implementation Plan

Implemented in three phases. Phase 1 is the core; Phases 2-3 follow separately.

### Phase 1 — Schema + Service + CRUD API + Webhooks

* **Affected paths**:
  - `backend/src/lib/db/schema.ts` — add `triggers` and `triggerRuns` tables
  - `backend/src/lib/services/trigger/` — new directory: `TriggerRepository`, `TriggerService` (singleton pattern, like `AgentConfigService`)
  - `backend/src/app/api/triggers/` — CRUD routes (collection + `[id]`)
  - `backend/src/app/api/triggers/[id]/runs/` — run history route
  - `backend/src/app/api/triggers/[id]/test/` — manual fire route
  - `backend/src/app/api/triggers/webhook/[id]/` — webhook endpoint

* **Dependencies**: `node-cron` (Phase 2 only, not needed for Phase 1)

* **Patterns to follow**:
  - Singleton service: `TriggerService.getInstance()` (see `AgentConfigService`)
  - Repository pattern: `TriggerRepository` for all DB queries
  - Auth: `requireAuth(request)` on CRUD routes, `LUCY_API_KEY` Bearer check on webhook route
  - All queries scoped by `userId` (CRUD) or by trigger ID (webhook)

* **Patterns to avoid**:
  - Do not modify `ChatService` — triggers call existing `runAgent` path
  - Do not create a "system user" — triggers run under their owner's userId
  - Do not add complex template engines — flat `{{payload.field}}` interpolation only

* **Schema details**:
  - `triggers` table: `id`, `userId` (FK users), `name`, `description`, `agentConfigId` (FK agentConfigs), `triggerType` (cron|webhook), `cronExpression`, `timezone`, `inputTemplate`, `enabled`, `maxTurns`, `maxRunsPerHour`, `cooldownSeconds`, `lastTriggeredAt`, `lastRunSessionId` (FK sessions), `createdAt`, `updatedAt`
  - `triggerRuns` table: `id`, `triggerId` (FK triggers), `sessionId` (FK sessions, nullable), `status` (pending|running|completed|failed|skipped), `skipReason`, `result`, `error`, `eventPayload` (jsonb), `startedAt`, `completedAt`
  - Indexes: `(userId)`, `(userId, triggerType)` on triggers; `(triggerId)`, `(triggerId, status)` on triggerRuns

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

### Phase 2 — Cron Scheduling (separate ADR if needed)

* Add `node-cron` dependency
* On server startup: load enabled cron triggers, register with scheduler
* On trigger CRUD: update in-process scheduler
* Graceful shutdown: stop all cron jobs

### Phase 3 — Frontend (separate work)

* Trigger management UI, run history view, test button

### Verification

- [ ] `triggers` and `triggerRuns` tables exist in schema and `db:push` succeeds
- [ ] CRUD routes work: create, list, get, update, delete triggers (JWT auth, userId scoping)
- [ ] `POST /api/triggers/:id/test` creates a session and runs the agent to completion
- [ ] `POST /api/triggers/webhook/:id` returns 401 without valid `LUCY_API_KEY`
- [ ] `POST /api/triggers/webhook/:id` with valid key creates session + triggerRun
- [ ] Rate limiting: trigger with `maxRunsPerHour=1` skips second run within the hour, triggerRun has status `skipped` with reason
- [ ] Cooldown: trigger with `cooldownSeconds=60` skips if fired within 60s of last run
- [ ] Input template interpolation: `{{payload.url}}` replaced with webhook body field
- [ ] triggerRuns audit log shows correct status progression (pending → running → completed/failed/skipped)
- [ ] Disabled triggers return 409 on webhook and are not executed

## More Information

* Full specification: [docs/specs/triggers.md](../specs/triggers.md)
* The three session initiator types after this ADR: User (SSE streaming), Agent (delegation, non-streaming), System (triggers, non-streaming)
* Revisit this decision if: multi-instance deployment is needed (migrate cron to pg-boss/BullMQ), or per-trigger webhook secrets are needed for security
