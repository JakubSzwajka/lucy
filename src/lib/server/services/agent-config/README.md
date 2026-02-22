# Agent Config Service

CRUD operations for agent configurations (personas, tool sets, delegation rules).

## Public API

- `getAgentConfigService()` - Singleton accessor
- `getAll(userId)` - List all configs for a user
- `getById(id, userId)` - Get a single config
- `create(data, userId)` - Create a new config
- `update(id, data, userId)` - Update an existing config
- `delete(id, userId)` - Delete a config

## Data Model

- `agentConfigs` table: name, description, systemPrompt, defaultModelId, maxTurns, isDefault
- `agentConfigTools` table: toolType (builtin | mcp | delegate), toolRef, toolName, toolDescription

## Usage

Used by `ChatService` to resolve system prompt, model, and tool filtering. Used by `SessionService` to assign configs to new sessions. Used by `AgentExecutionService` to enforce `maxTurns`.

## Related

- [Chat Service](../chat/README.md)
- [Session Service](../session/README.md)
- [Agent Execution Service](../agent/README.md)
