# lib

Backend capability and orchestration modules.

## Module Graph

- `services/` - orchestration layer used by routes
- `ai/` - model registry + provider clients
- `tools/` - tool registry/providers/modules for agent tool calls
- `memory/` - structured continuity memory subsystem
- `integrations/` - external/internal integration clients
- `auth/` - JWT and route auth guards
- `db/` - schema and DB singleton
- `openapi/` - spec builder

## Layering Rule

Higher-level modules call lower-level modules through stable interfaces.
Each directory README explains only that directory's contract.

## Read Next

- `services/README.md`
- `ai/README.md`
- `tools/README.md`
- `memory/README.md`
- `integrations/README.md`
