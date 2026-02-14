# Memory Storage Module

Storage boundary for memory-domain persistence.

## Public API

- `MemoryStore` interface (`memory-store.interface.ts`)
- `getMemoryStore()` factory (`index.ts`)
- `PostgresMemoryStore` implementation (`postgres-memory-store.ts`)

## Use It Like This

Domain services depend on `MemoryStore` interface, not concrete SQL details.

## Responsibility Boundary

Pure persistence operations for memory domain.
No route/session/tool orchestration logic here.
