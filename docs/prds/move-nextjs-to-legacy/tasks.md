---
prd: move-nextjs-to-legacy
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Move Next.js App to Legacy Directory

> Summary: Move the Next.js application into `-legacy/` directory, update root to be a clean workspace root, and fix all references (docs, CI, hooks, memory).

## Task List

- [x] **1. Create `-legacy/` and move Next.js files** — git mv all app files into `-legacy/`
- [x] **2. Create root workspace `package.json`** — minimal workspace root excluding `-legacy/`
- [x] **3. Update `.gitignore`** — add `-legacy/` specific ignore patterns
- [x] **4. Update `.husky` and lint-staged** — fix paths for new structure
- [x] **5. Update CI workflow** — adjust lint/typecheck/deploy for new paths
- [x] **6. Update `CLAUDE.md`** — reflect new directory structure and commands
- [x] **7. Update `README.md`** — reflect new repo purpose and structure `[blocked by: 1]`
- [x] **8. Update auto-memory** — fix paths in MEMORY.md `[blocked by: 6]`
- [x] **9. Clean up root artifacts** — remove leftover generated files (`.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`)

---

### 1. Create `-legacy/` and move Next.js files
<!-- status: done -->

Use `git mv` to move all Next.js-specific files and directories into `-legacy/`. This includes: `src/`, `public/`, `next.config.js`, `tsconfig.json`, `drizzle.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `docker-compose.yml`, `Dockerfile`, `railway.toml`, `.env.example`, `.lintstagedrc.mjs`, `.dockerignore`. The current `package.json` moves too (it becomes `-legacy/package.json` with the workspaces field removed). `.ai/` directory also moves if it's Next.js specific.

**Files:** `src/`, `public/`, `next.config.js`, `tsconfig.json`, `drizzle.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `docker-compose.yml`, `Dockerfile`, `railway.toml`, `.env.example`, `.lintstagedrc.mjs`, `.dockerignore`, `.ai/`, `package.json`
**Depends on:** —
**Validates:** `ls -legacy/src` shows the source tree; root has no Next.js config files; `git log --follow -legacy/src/app/page.tsx` shows history

---

### 2. Create root workspace `package.json`
<!-- status: done -->

Create a new minimal root `package.json` with npm workspaces pointing to `agents-runtime` and `agents-gateway-http` (excluding `-legacy/`). No dependencies at root level. Include a `name` field (e.g. `lucy`) and `private: true`. Remove the old Next.js scripts — root scripts can be added later as needed.

**Files:** `package.json` (new root)
**Depends on:** 1
**Validates:** `npm install` at root succeeds and hoists workspace deps; `npm ls --workspaces` shows both packages

---

### 3. Update `.gitignore`
<!-- status: done -->

Update `.gitignore` to handle the new structure. The Next.js specific entries (`.next/`, `next-env.d.ts`) should be scoped under `-legacy/` or kept global (they won't match at root anyway). Add `-legacy/node_modules` if `-legacy/` will have its own install. Remove `/memory` if it was Next.js specific.

**Files:** `.gitignore`
**Depends on:** 1
**Validates:** `git status` shows no unintended tracked/untracked files after the move

---

### 4. Update `.husky` and lint-staged
<!-- status: done -->

The pre-commit hook runs `npx lint-staged`. After the move, `.lintstagedrc.mjs` lives in `-legacy/`. Either: (a) create a root-level lint-staged config that delegates to each package, or (b) simplify the hook to run linting per-workspace. Since the Next.js app is legacy/reference, the simplest approach is to remove the lint-staged reference to it and only lint the active packages.

**Files:** `.husky/pre-commit`, `.lintstagedrc.mjs` (if creating root version)
**Depends on:** 1
**Validates:** `git commit` with a staged change in `agents-runtime/` doesn't error on missing lint-staged config

---

### 5. Update CI workflow
<!-- status: done -->

The CI runs lint (`npm run lint`) and typecheck (`npx tsc --noEmit`) at root, then deploys to Railway. After the move: lint and typecheck should target the active packages only (not `-legacy/`). The Railway deploy may need updating if the build context changed. Consider whether CI should still deploy the Next.js app or skip it.

**Files:** `.github/workflows/ci.yml`
**Depends on:** 1
**Validates:** CI workflow YAML is valid; lint/typecheck jobs reference correct paths

---

### 6. Update `CLAUDE.md`
<!-- status: done -->

Update the project structure diagram, command table, file paths, and conventions to reflect that the Next.js app now lives in `-legacy/`. Add a note that `-legacy/` is a reference implementation. Update the `@/` alias documentation. Keep the bulk of the CLAUDE.md focused on the active packages and shared docs.

**Files:** `CLAUDE.md`
**Depends on:** 1
**Validates:** All file paths mentioned in CLAUDE.md exist at the referenced locations

---

### 7. Update `README.md`
<!-- status: done -->

Rewrite the root README to describe the repository as a multi-package workspace for agent infrastructure. Mention `-legacy/` as the reference Next.js app. List the active packages with one-line descriptions. Update getting started instructions.

**Files:** `README.md`
**Depends on:** 1
**Validates:** README accurately describes the current repo structure

---

### 8. Update auto-memory
<!-- status: done -->

Update `MEMORY.md` in the Claude auto-memory directory to reflect new paths (`-legacy/src/` instead of `src/`, new root package.json structure, updated commands). Remove stale entries that reference root-level Next.js files.

**Files:** `~/.claude/projects/-Users-kuba-szwajka-DEV-priv-lucy-nextjs/memory/MEMORY.md`
**Depends on:** 6
**Validates:** Memory file paths match actual repo structure

---

### 9. Clean up root artifacts
<!-- status: done -->

Delete generated/cached files that remain at root after the move: `.next/` (build cache), `next-env.d.ts`, `tsconfig.tsbuildinfo`, `node_modules/` (will be regenerated by workspace install). These are gitignored but clutter the working directory.

**Files:** `.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `node_modules/`
**Depends on:** 1, 2
**Validates:** Root directory only contains: `-legacy/`, `agents-runtime/`, `agents-gateway-http/`, `docs/`, `.git/`, `.github/`, `.husky/`, `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `node_modules/` (workspace root)
