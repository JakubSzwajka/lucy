# Session Service Module

Session lifecycle orchestration.

## Public API

- `getSessionService()`
- query: `getAll`, `getById`, `getWithAgents`
- write: `create`, `update`, `updateTitle`, `maybeGenerateTitle`, `delete`
- lifecycle: `touch`, `archive`, `reactivate`

## Use It Like This

Use this service for user-visible session operations and lifecycle transitions.

## Read Next

- [Chat Service](../chat/README.md) — turn orchestration within a session
- [Agent Config Service](../agent-config/README.md) — config resolution on session create
- [Agent Service](../agent/README.md) — agent lifecycle within sessions
