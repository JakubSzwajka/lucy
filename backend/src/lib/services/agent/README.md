# Agent Service Module

Agent lifecycle, tree orchestration, and sub-agent execution for a session.

## Public API

### AgentService (`getAgentService()`)

CRUD and status management for agents within a session.

- `getById`, `getTreeBySessionId`, `create`, `update`, `updateStatus`
- `markRunning`, `markCompleted`, `markFailed`, `incrementTurnCount`, `delete`

### AgentExecutionService (`getAgentExecutionService()`)

Runs sub-agent execution loops (non-streaming `generateText`) for delegate tools.

- `executeSubAgent(parentAgentId, sessionId, userId, agentConfigId, task, sourceCallId)` - Creates and runs a child agent to completion
- `continueSubAgent(childAgentId, parentAgentId, userId, message)` - Sends a follow-up message to an existing child agent

Both methods respect the agent config's `maxTurns` setting (default: 25). When the turn limit is reached, the result is appended with "[max turns reached]".

## Usage

Use `AgentService` for agent lifecycle operations. Use `AgentExecutionService` from delegate tool handlers to run sub-agents.

## Related

- [Agent Config Service](../agent-config/README.md) - Provides maxTurns and config resolution
- [Delegate Tools](../../tools/delegate/README.md) - Tools that trigger sub-agent execution
