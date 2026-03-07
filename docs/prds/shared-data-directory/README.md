---
status: draft
date: 2026-03-07
author: kuba
gh-issue: ""
---

# Shared Data Directory for Agent Consumers

## Problem

The agents-runtime stores all data (agents, items, configs, sessions) in a file-based directory structure. Currently, the `DATA_DIR` is configured per-consumer (agents-gateway-http hardcodes it via its own `config.ts`). When we add agents-gateway-cli, both consumers need to read/write the same data directory so a user can start a session via HTTP and continue it via CLI (or vice versa). There's no shared contract for where data lives — each consumer sets its own path independently, making coordination fragile.

## Proposed Solution

Promote the data directory path to a first-class configuration concern at the **agents-runtime** level rather than leaving it to each consumer. The runtime should accept a `dataDir` option and provide a standard resolution chain: explicit parameter > environment variable > default. All file-based adapters already receive the path via `createFileAdapters(dataDir)` — we just need to standardize how that path is determined and documented so every consumer resolves it the same way.

## Key Cases

- **Explicit path**: Consumer passes `dataDir` to runtime — used as-is
- **Environment variable**: If no explicit path, runtime reads `AGENTS_DATA_DIR` env var
- **Default fallback**: If neither is set, defaults to `~/.agents-data` (user home, not CWD — so it's stable across invocations from different directories)
- **CLI + HTTP sharing**: Both gateway-http and future gateway-cli resolve the same path, enabling session continuity across consumers
- **Validation on startup**: Runtime validates the directory exists (or creates it) and warns on permission issues

## Out of Scope

- Data format changes (JSON/JSONL structure stays the same)
- Remote storage backends (S3, database) — file-based only for now
- Multi-user data isolation within a shared directory
- Locking or concurrent-write safety between consumers

## Open Questions

- Should the default be `~/.agents-data` (home dir) or `.agents-data` (CWD)? Home dir is more predictable for CLI usage; CWD is more project-scoped. Leaning toward home dir with an env var override.
- Do we need a `agents-data init` command or similar to bootstrap the directory structure, or is auto-creation on first write sufficient?

## References

- `agents-runtime/src/adapters/index.ts` — `createFileAdapters(dataDir)` entry point
- `agents-gateway-http/src/config.ts` — current `DATA_DIR` configuration
- `agents-runtime/src/types.ts` — data model types
