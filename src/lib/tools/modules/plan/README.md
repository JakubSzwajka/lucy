# Plan Tool Module

Planning tools over `PlanService`.

## Tool Surface

- `create_plan`
- `update_plan`
- `get_plan`

## Backend Capability

Uses plan integration (`integrationId: "plan"`) and delegates to `PlanService`.

## Responsibility Boundary

Defines tool input/output for agent use.
Plan lifecycle semantics belong to plan service.
