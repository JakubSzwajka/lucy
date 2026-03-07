# Triggers

Webhook triggers and scheduled task execution.

## Public API

- `TriggerService`, `getTriggerService()` — trigger CRUD and execution
- `TriggerRepository`, `getTriggerRepository()` — trigger persistence
- `TriggerScheduler`, `getTriggerScheduler()` — pg-boss based scheduling

## Responsibility Boundary

Owns trigger lifecycle and scheduling. Delegates chat execution to `chat/` and session management to `domain/`.
