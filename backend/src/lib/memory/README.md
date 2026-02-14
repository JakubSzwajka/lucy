# Memory Module

Structured continuity subsystem (memories, questions, identity, extraction, retrieval settings).

## Public API

- services: `getMemoryService()`, `getQuestionService()`, `getIdentityService()`
- retrieval/settings helpers: `getMemoryStore()`, `getMemorySettings()`
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

## Read Next

- `storage/README.md`
