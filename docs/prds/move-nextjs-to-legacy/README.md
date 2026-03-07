---
status: accepted
date: 2026-03-07
author: kuba
gh-issue: ""
---

# Move Next.js App to Legacy Directory

## Problem

The repository root is cluttered with Next.js application files (`src/`, `public/`, `next.config.js`, `tsconfig.json`, `drizzle.config.ts`, `postcss.config.mjs`, etc.) alongside the new standalone packages (`agents-runtime`, `agents-gateway-http`). As more standalone packages are added, the root becomes harder to navigate and the Next.js app's presence implies it's the primary project when it's now a reference implementation.

## Proposed Solution

Move the entire Next.js application into a `.legacy/` directory at the repo root. This preserves the app as a reference for module patterns and code while clearing the top-level directory for standalone packages and shared infrastructure.

Target structure:

```
lucy-nextjs/
├── .legacy/                  # Next.js reference app (moved here)
│   ├── src/
│   ├── public/
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── railway.toml
│   ├── .env.example
│   ├── .lintstagedrc.mjs
│   └── package.json          # Next.js deps only
├── agents-runtime/           # Standalone package
├── agents-gateway-http/      # Standalone package
├── docs/                     # Shared docs (stays at root)
├── CLAUDE.md                 # Updated for new structure
├── README.md                 # Updated for new structure
├── package.json              # Minimal root or workspace root
└── .gitignore                # Updated paths
```

## Key Cases

- **Moving files** — All Next.js-specific files and directories (`src/`, `public/`, config files, Dockerfile, docker-compose, railway.toml, `.env.example`) move into `.legacy/` using `git mv`
- **Shared files stay** — `docs/`, `CLAUDE.md`, `README.md`, `.git/`, `.github/`, `.gitignore` remain at root
- **Import paths** — The `@/` alias in `.legacy/tsconfig.json` resolves within `.legacy/src/` (should work as-is since tsconfig moves with src)
- **Dependencies** — `.legacy/` gets the current `package.json` with all Next.js deps; root gets a minimal one
- **Dev workflow** — Running the Next.js app requires `cd .legacy && npm install && npm run dev`
- **CLAUDE.md update** — Reflect new paths so agents navigate correctly
- **`.husky` hooks** — Check and update any scripts referencing root-level Next.js paths

## Out of Scope

- Refactoring or modifying the Next.js application code itself
- Converting to a monorepo tool (turborepo, nx, etc.)
- Removing the Next.js app entirely
- Moving `docs/` or `.github/` directories
- Changing standalone package structure

## Decisions

- Root `package.json` becomes an npm workspace root (excludes `.legacy/` from workspaces)
- `.husky/` stays at root (git-level concern), hooks updated if they reference moved paths

## References

- `docs/prds/extract-agent-runtime-and-gateways/` — related PRD for standalone packages
