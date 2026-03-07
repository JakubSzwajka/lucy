# src

Application source root.

## Layers

- `app/` - Pages + API route handlers
- `lib/server/` - Backend modules (services, auth, AI, tools, memory, integrations, db)
- `lib/client/` - Browser modules (API client, React Query helpers, utilities)
- `components/` - React components
- `hooks/` - Custom React hooks
- `types/` - Shared domain types

## Design Rule

Routes should stay thin. Business behavior belongs in service/capability modules.

## Read Next

- [app/README.md](app/README.md)
- [lib/README.md](lib/README.md)
- [hooks/README.md](hooks/README.md)
- [types/README.md](types/README.md)
