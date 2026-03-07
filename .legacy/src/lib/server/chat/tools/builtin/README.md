# Builtin Tools

Agent-callable tools bundled with the platform.

## Modules

- **continuity** — structured memory (save/find/list/update/delete/tags/questions)
- **plan** — execution plans (create/update/get)
- **delegate** — sub-agent delegation and session continuation

## Public API

- `allToolModules` — array of all builtin `ToolModule` definitions
- `getToolModule(id)` — lookup by module ID
- `generateDelegateTools()` — create delegate tools from agent config

## Responsibility Boundary

Defines tool schemas and execute handlers. Delegates actual work to services: `memory/` for continuity, `plans/` for planning, `sessions/` + `chat/` for delegation.

## Read Next

- [Tools](../README.md)
- [Memory](../../../memory/README.md)
- [Plans](../../../plans/README.md)
