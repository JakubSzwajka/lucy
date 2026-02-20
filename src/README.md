# src

Backend source root.

## Layers

- `app/api/` - HTTP adapters (route handlers)
- `lib/services/` - orchestration and business services
- `lib/*` capability modules - auth, AI, tools, memory, integrations
- `lib/db/` - schema and DB access
- `types/` - shared backend domain types

## Design Rule

Routes should stay thin. Business behavior belongs in service/capability modules.

## Read Next

- `app/README.md`
- `lib/README.md`
- `types/README.md`
