# Lucy

AI agent infrastructure — a multi-package workspace for building autonomous agent systems.

## Repository Structure

```
lucy/
├── agents-runtime/          # Standalone agent execution loop
│   └── README.md
├── agents-gateway-http/     # REST gateway for agent runtime (Hono)
│   └── README.md
├── agents-webui/            # Browser-based chat UI (Vite + React)
├── .legacy/                 # Archived Next.js app (reference only)
├── docs/
│   ├── decisions/           # Architecture Decision Records (ADRs)
│   ├── prds/                # Product Requirement Documents
│   └── data-flows.md
├── .github/
│   └── workflows/           # CI/CD
├── .husky/                  # Git hooks (pre-commit)
├── CLAUDE.md                # AI assistant project instructions
├── package.json             # Workspace root
└── README.md
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`agents-runtime`](agents-runtime/) | Standalone agent execution loop with file-based adapters | Active |
| [`agents-gateway-http`](agents-gateway-http/) | REST gateway for the agent runtime (Hono) | Active |
| [`agents-webui`](agents-webui/) | Browser-based chat UI for interacting with agents | Active |

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
