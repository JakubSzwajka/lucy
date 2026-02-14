# Plan Service Module

Planning orchestration for session/agent execution plans.

## Public API

- `getPlanService()`
- read: `getById`, `getBySessionId`, `getByAgentId`, `getProgress`
- write: `create`, `update`, `delete`, `startStep`, `completeStep`, `failStep`

## Use It Like This

Use this service when features/tools need plan lifecycle management with derived plan status.
