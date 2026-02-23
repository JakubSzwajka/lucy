# Chat

The agent execution engine — takes a query + tools + model, streams or generates a response.

## Public API

- `ChatService`, `getChatService()` — execute chat turns (streaming SSE) and run agents (non-streaming)
- `cancelAgent(agentId)` — abort a running agent
- `persistStepContent()` — save AI SDK step output to DB
- Types: `ChatContext`, `ChatPrepareOptions`, `ExecuteTurnOptions`, `ModelMessage`, `ChatFinishResult`

## Responsibility Boundary

Owns the full chat lifecycle: system prompt resolution, tool loading, model invocation, step persistence, and agent finalization. Delegates entity CRUD to `sessions/`, config lookup to `config/`. Tool registry and builtin tools live inside `tools/` as a child module.

## Read Next

- [Tools](./tools/README.md)
- [Sessions](../sessions/README.md)
- [Config](../config/README.md)
- [Memory](../memory/README.md)
