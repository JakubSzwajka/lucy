---
prd: railway-deploy
generated: 2026-03-07
last-updated: 2026-03-07
---

# Tasks: Docker-based Deployment via Makefile

> Summary: Containerize `agents-gateway-http` with a multi-stage Dockerfile, add Makefile targets for local Docker and Railway deployment.

## Task List

- [x] **1. Add .env.example to repo root** — document required env vars for deployment
- [x] **2. Add Dockerfile for agents-gateway-http** — multi-stage build from workspace root
- [x] **3. Create Makefile with docker and deploy targets** — build, run, deploy commands
- [x] **4. Add .dockerignore** — keep image lean
- [ ] **5. Smoke-test deploy** — verify local docker-run and Railway deploy

---

### 1. Add .env.example to repo root
<!-- status: done -->

Create a `.env.example` at the repo root listing the env vars needed for deployment. Currently just `OPENROUTER_API_KEY`. This gives contributors a clear reference without exposing actual values. The root `.gitignore` already excludes `.env*` but allows `.env.example`.

**Files:** `.env.example`
**Depends on:** —
**Validates:** File exists, contains `OPENROUTER_API_KEY=` placeholder, is tracked by git.

---

### 2. Add Dockerfile for agents-gateway-http
<!-- status: done -->

Create a `Dockerfile` at the repo root. Multi-stage build: (1) install stage copies `package.json`, `package-lock.json`, and workspace package.jsons, runs `npm ci --workspace=agents-runtime --workspace=agents-gateway-http`; (2) runtime stage copies source for `agents-runtime/` and `agents-gateway-http/`, sets entrypoint to `npm run start --workspace=agents-gateway-http`. Use `node:22-slim` as base. The gateway uses `tsx` at runtime so dev deps are needed — or consider a build step to compile TS first for a leaner image.

**Files:** `Dockerfile`
**Depends on:** —
**Validates:** `docker build -t lucy-gateway .` succeeds. `docker run -e OPENROUTER_API_KEY=test -p 3080:3080 lucy-gateway` starts and `/health` returns 200.

---

### 3. Create Makefile with docker and deploy targets
<!-- status: done -->

Create a `Makefile` at the repo root with these targets:

- `docker-build` — builds the Docker image tagged `lucy-gateway`
- `docker-run` — runs the container locally, passing `OPENROUTER_API_KEY` from env
- `deploy` — checks prerequisites (railway CLI, `OPENROUTER_API_KEY`), sets secrets via `railway variables set`, runs `railway up`
- `deploy-secrets` — sets/updates secrets on Railway without redeploying

Load `.env` if present (via `sinclude .env` + `export`). Fail fast with descriptive errors for missing CLI tools or secrets.

**Files:** `Makefile`
**Depends on:** 1, 2
**Validates:** `make docker-build` builds successfully. `make deploy` fails gracefully when `railway` CLI is missing or `OPENROUTER_API_KEY` is unset.

---

### 4. Add .dockerignore
<!-- status: done -->

Create a `.dockerignore` to exclude `.legacy/`, `node_modules/`, `.git/`, `.agents-data/`, `dist/`, `.env*` (except `.env.example`), and other non-essential files from the Docker build context. Keeps image small and build fast.

**Files:** `.dockerignore`
**Depends on:** —
**Validates:** Docker build context is under 1MB (excluding node_modules which are installed inside the container).

---

### 5. Smoke-test deploy
<!-- status: pending -->

Run `make docker-build && make docker-run` locally — verify `/health` responds 200 and the gateway logs its listen message. Then `make deploy` to Railway — verify the deployed URL returns 200 on `/health`. Document the Railway project URL in the notebook.

**Files:** —
**Depends on:** 3, 4
**Validates:** `curl localhost:3080/health` returns 200 locally. `curl <railway-url>/health` returns 200 remotely.
