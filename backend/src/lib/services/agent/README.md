# Agent Service Module

Agent lifecycle management for sessions.

## Public API

### AgentService (`getAgentService()`)

CRUD and status management for agents within a session.

- `getById`, `getTreeBySessionId`, `create`, `update`, `updateStatus`
- `markRunning`, `markCompleted`, `markFailed`, `incrementTurnCount`, `delete`

## Usage

Use `AgentService` for agent lifecycle operations. Sub-agent execution is handled directly by delegate tools via `ChatService.runAgent()`.

## Related

- [Chat Service](../chat/README.md) - Provides `runAgent()` for unified execution
- [Delegate Tools](../../tools/delegate/README.md) - Create child sessions and run sub-agents
