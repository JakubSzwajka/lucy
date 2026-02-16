# Memory Module

Structured continuity subsystem (memories, questions, identity, extraction, retrieval settings).

## Public API

- services: `getMemoryService()`, `getQuestionService()`, `getIdentityService()`
- retrieval/settings helpers: `getMemoryStore()`, `getMemorySettings()`
- auto-reflection: `maybeAutoReflect()`
- types exported from `types.ts`

## Use It Like This

```ts
import { getMemoryService } from "@/lib/memory";

const service = getMemoryService();
const { memory } = await service.create(userId, input, evidence);
```

## Responsibility Boundary

This module owns memory-domain behavior.
Routes/services consume it as a capability and should not duplicate memory rules.

## Auto-Reflection

Token-based background memory extraction. After each streaming chat turn, `ChatService.onFinish` calls `maybeAutoReflect()` fire-and-forget. It counts tokens from all item types (messages, tool calls, tool results, reasoning) accumulated since the last reflection. Progress is persisted on the session (`reflectionTokenCount`, `lastReflectionItemCount`) so it survives server restarts and is visible to the frontend. When the threshold is exceeded (default 5000, configurable via `memorySettings.reflectionTokenThreshold`), runs `ExtractionService.extract()` → auto-confirms results above `autoSaveThreshold`. Gated by `memorySettings.autoExtract`. See `auto-reflection.service.ts`.

## Read Next

- `storage/README.md`
