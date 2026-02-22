# Chat Service Module

Turn orchestrator for session chat execution.

## Public API

- `getChatService()`
- `executeTurn(sessionId, userId, message, options)` — accepts a single `IncomingUserMessage` (not full history)
- preparation helpers: `prepareChat`, `prependSystemPrompt`, `finalizeChat`

## How It Works

The frontend sends only the new user message. The backend:
1. Persists the user message (including multimodal `contentParts` if present)
2. Loads all items from DB for the agent
3. Builds `ModelMessage[]` from items via `itemsToModelMessages()` (with ISO timestamp prefixes)
4. Passes to `runAgent()` for streaming or non-streaming execution

## Responsibility Boundary

This module orchestrates a full turn.
It should not expose provider/integration internals to route handlers.

## Read Next

- `../agent-config/README.md`
- `../../ai/README.md`
- `../../tools/README.md`
