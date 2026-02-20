# Continuity Tool Module

Structured memory tool exposed as `continuity`.

## Tool Surface

- action `save`
- action `find`
- action `update`
- action `supersede`

## Backend Capability

Uses `@/lib/memory` services for persistence/search/update semantics.

## Responsibility Boundary

Defines tool schema and execution mapping.
Memory business rules remain in memory services/store.
