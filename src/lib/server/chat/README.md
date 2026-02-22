# Chat

Core chat orchestration — streaming turns, non-streaming agent execution, and step persistence.

## Public API

- `ChatService`, `getChatService()` — execute chat turns (streaming SSE) and run agents (non-streaming)
- `cancelAgent(agentId)` — abort a running agent
- `persistStepContent()` — save AI SDK step output to DB
- Types: `ChatContext`, `ChatPrepareOptions`, `ExecuteTurnOptions`, `ModelMessage`, `ChatFinishResult`

## Responsibility Boundary

Owns the full chat lifecycle: system prompt resolution, tool loading, model invocation, step persistence, and agent finalization. Delegates entity CRUD to `domain/`, tool resolution to `tools/`, and config lookup to `config/`.

## Read Next

- [Domain](../domain/README.md)
- [Tools](../tools/README.md)
- [Config](../config/README.md)
