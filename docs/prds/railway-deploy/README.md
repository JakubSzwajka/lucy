---
title: Docker-based Deployment via Makefile
status: draft
date: 2026-03-07
author: kuba
gh-issue: null
---

# Docker-based Deployment via Makefile

## Problem

The `agents-gateway-http` service is ready to run but there's no deployment story. We need a provider-agnostic containerized build and a simple `make deploy` command to push it to Railway (or any Docker-compatible host) with secrets from local env.

## Proposed Solution

Add a `Dockerfile` for the gateway that builds from the workspace root (multi-stage: install deps, copy workspace packages, start the service). The Makefile provides `docker-build`, `docker-run`, and `deploy` targets. Railway auto-detects the Dockerfile — no provider-specific config needed.

Secrets (currently just `OPENROUTER_API_KEY`) are read from the local shell environment or `.env` — never committed to git. The Dockerfile itself contains no secrets; they're injected at runtime via env vars.

### Deployment Shape

```
Docker Image (built from workspace root)
  ├── agents-runtime/        (workspace dependency)
  └── agents-gateway-http/   (entrypoint)
        ├── OPENROUTER_API_KEY (runtime env var)
        └── PORT (set by host / defaults to 3080)
```

### Key Decisions

- **Dockerfile over nixpacks/buildpacks** — portable across Railway, Fly, any VPS, CI
- **Multi-stage build from workspace root** — gateway depends on `agents-runtime` via workspace link
- **Makefile for orchestration** — `docker-build`, `docker-run` locally, `deploy` to Railway
- **Secrets from local env** — no secrets in git; fail fast if missing
- **Single service for now** — only gateway; other packages added later as needed

## Key Cases

- `make docker-build` — build the Docker image locally
- `make docker-run` — run the container locally with secrets from env
- `make deploy` — push to Railway via CLI with secrets
- `make deploy-secrets` — update secrets on Railway without redeploying
- Missing `OPENROUTER_API_KEY` — fail fast with clear error
- Missing `docker` or `railway` CLI — fail fast with install instructions

## Out of Scope

- CI/CD (GitHub Actions, auto-deploy on push)
- Multiple environments (staging/prod)
- Custom domains
- Deploying other workspace packages (webui, landing page)
- Database provisioning (runtime uses file-based adapters)
- Docker Compose (single service, not needed yet)
