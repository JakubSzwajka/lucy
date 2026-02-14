# Chat Service Module

Turn orchestrator for session chat execution.

## Public API

- `getChatService()`
- `executeTurn(sessionId, userId, chatMessages, options)`
- preparation helpers: `prepareChat`, `convertToModelMessages`, `prependSystemPrompt`, `finalizeChat`

## Use It Like This

Routes should call `executeTurn(...)` and stream returned response.
This service handles message persistence, tool setup, memory/env context injection, telemetry, and finalization.

## Responsibility Boundary

This module orchestrates a full turn.
It should not expose provider/integration internals to route handlers.
