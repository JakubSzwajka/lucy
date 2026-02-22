# Tool Modules

Builtin tool definitions grouped by capability.

## Current Modules

- `continuity` - structured memory tool (internal memory subsystem)
- `plan` - planning tools (`create_plan`, `update_plan`, `get_plan`)

## Module Contract

Each module defines:
- `id`, `name`, `description`
- `createTools(null)` returning tool definitions (modules load their own dependencies)

## Responsibility Boundary

Define tool behavior and schemas.
Do not manage provider discovery/registry lifecycle here.

## Read Next

- `continuity/README.md`
- `plan/README.md`
