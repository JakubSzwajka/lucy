# Tool Modules

Builtin tool definitions grouped by capability.

## Current Modules

- `notes` - note CRUD tools (Obsidian-backed)
- `memory` - legacy entity/fact memory tool (Obsidian + conversation search)
- `continuity` - structured memory tool (internal memory subsystem)
- `plan` - planning tools (`create_plan`, `update_plan`, `get_plan`)

## Module Contract

Each module defines:
- `id`, `name`, `description`
- `integrationId` (`null` for internal-only modules)
- `createTools(client)` returning tool definitions

## Responsibility Boundary

Define tool behavior and schemas.
Do not manage provider discovery/registry lifecycle here.
