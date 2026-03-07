# Lucy

AI agent infrastructure — a multi-package workspace for building autonomous agent systems.

## Packages

| Package | Description |
|---------|-------------|
| `agents-runtime` | Standalone agent execution loop with file-based adapters |
| `agents-gateway-http` | REST gateway for the agent runtime (Hono) |

## Getting Started

```bash
npm install          # Install workspace dependencies
```

See individual package READMEs for usage instructions.

## Legacy Reference

The `.legacy/` directory contains the original Next.js web application (JWT auth, multi-user, PostgreSQL). It is kept as a reference for module patterns — services, database schema, auth, tools, and memory systems. It is not actively developed.

```bash
cd .legacy
npm install
npm run dev          # Starts on port 3009
```
