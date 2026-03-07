# Plans

Execution plan tracking — multi-step task management for agents.

## Public API

- `PlanService`, `getPlanService()` — plan CRUD, step operations, progress tracking
- `PlanRepository`, `getPlanRepository()` — direct DB queries
- Types: `PlanWithSteps`, `CreatePlanInput`, `UpdatePlanInput`

## Responsibility Boundary

Owns plan and step persistence, status derivation, and progress calculation. Used by the plan builtin tool during chat.

## Read Next

- [Chat Tools](../chat/tools/builtin/README.md)
