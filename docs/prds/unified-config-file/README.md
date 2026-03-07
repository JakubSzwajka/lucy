---
status: draft
date: 2026-03-07
author: kuba
gh-issue: ""
---

# Unified Config File (`lucy.config.json`)

## Problem

Runtime configuration (which plugins are enabled, per-plugin settings, adapter options) is currently passed programmatically through `bootstrapAgentRuntime()`. This works for library consumers, but for deployment scenarios (Docker, Railway, self-hosted) there is no declarative way to configure the system. Operators must write TypeScript entrypoints to change plugin selection or settings, which is a barrier for anyone who just wants to mount a config file into a container.

Additionally, as the workspace grows (runtime, memory, gateway, future packages), each module may need its own configuration section. Without a unified config shape, deployments risk juggling multiple config files or env vars per module.

## Proposed Solution

Introduce a single `lucy.config.json` file that serves as the declarative configuration surface for all Lucy packages. Each workspace module gets a top-level key in the JSON structure:

```json
{
  "agents-runtime": {
    "plugins": {
      "enabled": ["memory"],
      "configById": {
        "memory": { "initialMemory": { "content": "...", "title": "..." } }
      }
    }
  },
  "agents-memory": { ... },
  "agents-gateway-http": { ... }
}
```

A shared `loadConfig(path?)` utility reads and validates this file at startup. Each package extracts its own section. The file path defaults to `./lucy.config.json` but can be overridden via `LUCY_CONFIG_PATH` env var. For Docker deployments, operators mount this file as a volume.

The programmatic API remains the primary interface — the config file is sugar that feeds into the same `bootstrapAgentRuntime()` options. Code-level overrides (custom adapters, callbacks) still require a TS entrypoint.

## Key Cases

- Deploy with a mounted `lucy.config.json` that enables the memory plugin with static initial memory content, without writing any TypeScript.
- Override config file path via `LUCY_CONFIG_PATH` env var for flexible container layouts.
- Each package reads only its own top-level key; unknown keys are ignored (forward-compatible).
- Missing config file falls back to defaults (no plugins, default adapters) — zero-config still works.
- Gateway and runtime both read from the same file but extract their respective sections.
- Config file is validated at load time with clear error messages for malformed JSON or invalid plugin references.
- Programmatic options merge with (and override) file-based config when both are provided.

## Out of Scope

- TypeScript config files (`lucy.config.ts`) with code-level hooks — stays programmatic-only.
- Runtime hot-reload of config changes — requires restart.
- Config UI or web-based config editor.
- Plugin auto-discovery or dynamic `import()` from package names in config — plugin registry remains code-defined.
- Schema generation or JSON Schema publishing (can be added later).
- Per-environment config merging (dev/staging/prod overlays).

## Decisions

- **Validation:** Runtime type checks at load time. No JSON Schema for now.
- **Gateway config scope:** Agent-related settings only. Server concerns (CORS, port, auth) stay in code / env vars.
- **Secrets:** Always via env vars. Config file is for app configuration and feature variants, not secrets.

## References

- `agents-runtime/src/plugins/bootstrap.ts` — current programmatic bootstrap
- `agents-runtime/src/types/plugins.ts` — `RuntimeConfig`, `RuntimePluginsConfig`
- `agents-memory/src/types.ts` — `MemoryPluginConfig`
- `agents-runtime/scripts/smoke-test.ts` — example of programmatic config with memory plugin
- `docs/prds/runtime-plugin-interface-and-memory-scaffold/README.md` — plugin system PRD
- `Dockerfile` / `Makefile` — existing Docker deployment setup
