# Integrations Module

Registry of integration adapters that provide clients to tool modules.

## Public API

- `allIntegrations`, `getIntegration(id)`
- concrete integration exports: `plan`, `mcp`
- `SimpleIntegration` contract

## Use It Like This

Tool providers resolve integration -> create client -> hand client to tool module factory.

## Responsibility Boundary

This layer defines integration availability/client creation.
It does not define tool behavior (that is `tools/modules`).

## Read Next

- `../tools/modules/README.md`
- `mcp/README.md`
