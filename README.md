# Backend

Cloud backend for Lucy (Next.js app router API + service layer).

## Documentation Contract (Lego Modules)

This backend is documented as composable modules at multiple granularities.

Rules:
- Each module directory has a short `README.md`.
- A module README documents only its own public contract: what it does, how to call it, what it returns.
- Orchestration-layer READMEs do not explain internals of child modules.
- To go deeper, follow links to child module READMEs.

Think of this as a graph: route layer -> service layer -> capability/integration layer -> storage.

## Entry Points

- App routes: `src/app/api/`
- Service orchestrators: `src/lib/server/services/`
- Capabilities: `src/lib/server/memory/`, `src/lib/server/tools/`, `src/lib/server/integrations/`, `src/lib/server/ai/`
- Persistence: `src/lib/server/db/`

## Start

```bash
cd backend
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

## Read Next

- `src/README.md`
- `src/app/api/README.md`
- `src/lib/README.md`
