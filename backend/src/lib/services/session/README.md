# Session Service Module

Session lifecycle orchestration.

## Public API

- `getSessionService()`
- query: `getAll`, `getById`, `getWithAgents`
- write: `create`, `update`, `updateTitle`, `maybeGenerateTitle`, `delete`
- lifecycle: `touch`, `archive`, `reactivate`

## Use It Like This

Use this service for user-visible session operations and lifecycle transitions.
