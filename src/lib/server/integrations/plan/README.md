# Plan Integration

Thin integration exposing internal `PlanService` as a tool client.

## Public API

- `planIntegration`

## Use It Like This

Tool modules can depend on `integrationId: "plan"` and receive a `PlanService` client.
