# Memory Module

Structured continuity subsystem (memories, questions, identity, retrieval settings).

## Public API

- services: `getMemoryService()`, `getQuestionService()`, `getIdentityService()`
- retrieval/settings helpers: `getMemoryStore()`, `getMemorySettings()`
- auto-reflection: `maybeAutoReflect()`
- types exported from `types.ts`

## Use It Like This

```ts
import { getMemoryService } from "@/lib/server/memory";

const service = getMemoryService();
const { memory } = await service.create(userId, input, evidence);
```

## Responsibility Boundary

This module owns memory-domain behavior.
Routes/services consume it as a capability and should not duplicate memory rules.

## Auto-Reflection

Token-based background memory reflection. After each streaming chat turn, `ChatService.onFinish` calls `maybeAutoReflect()` fire-and-forget. It counts tokens from all item types (messages, tool calls, tool results, reasoning) accumulated since the last reflection. Progress is persisted on the session (`reflectionTokenCount`, `lastReflectionItemCount`) so it survives server restarts and is visible to the frontend. When the threshold is exceeded (default 5000, configurable via `memorySettings.reflectionTokenThreshold`), creates a reflection session using the user's configured `reflectionAgentConfigId` and runs the agent non-streaming via `ChatService.runAgent()`. The agent uses its configured tools (read/create/update memories, etc.) to decide what to persist. Gated by `memorySettings.autoExtract` and requires a `reflectionAgentConfigId` to be set. See `auto-reflection.service.ts`.

## Read Next

- `storage/README.md`
