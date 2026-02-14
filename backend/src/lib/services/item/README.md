# Item Service Module

Polymorphic item operations (messages, tool calls/results, reasoning).

## Public API

- `getItemService()`
- query: `getByAgentId`, `getById`, `getByCallId`
- create helpers: `createMessage`, `createToolCall`, `createToolResult`, `createReasoning`
- lifecycle: `updateToolCallStatus`

## Use It Like This

Use this service for conversation-thread persistence and typed item creation helpers.
