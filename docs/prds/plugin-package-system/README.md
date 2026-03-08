---
status: draft
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Plugin Package System — dynamic, config-driven plugin loading

## Problem

Adding a new plugin to Lucy requires touching 4+ files: the plugin package itself, the gateway's hardcoded import/registry, the Dockerfile (explicit COPY per plugin), and the config. The gateway acts as a manual wiring hub — it imports every plugin by name, constructs each one with package-specific options, and builds a registry object. This makes the plugin boundary feel like internal code rather than a composable package system.

The current plugin system is hard to reason about: two separate registries (runtime vs gateway), two separate config sections, and per-plugin wiring code that obscures the simple intent of "use this plugin." A new contributor shouldn't need to understand the gateway internals to add a plugin.

## Proposed Solution

Make plugins self-describing workspace packages that the system loads dynamically from config. The mechanism is simple and uses what Node.js workspaces already provide — workspace packages resolve like installed npm packages via symlinks in `node_modules/`.

Each plugin package exports a **named `manifest`** conforming to `PluginManifest` (defined in `agents-runtime`). The manifest declares the plugin's type (runtime, gateway, or both), a factory function, and an optional config schema. The gateway reads package names from `lucy.config.json` and uses dynamic `import()` to load them — no hardcoded imports.

### Config

A single flat `plugins` array in `lucy.config.json`. Each entry is a package name with optional config:

```jsonc
{
  "plugins": [
    { "package": "agents-memory" },
    { "package": "agents-plugin-whatsapp", "config": { "phoneNumberId": "..." } }
  ]
}
```

No more separate `agents-runtime.plugins` and `agents-gateway-http.plugins` sections — one list, one place to look.

### Plugin manifest

Each plugin package exports a predictable shape:

```typescript
// agents-memory/src/index.ts
import { PluginManifest } from "agents-runtime";

export const manifest: PluginManifest<MemoryConfig> = {
  id: "memory",
  type: "runtime",           // "runtime" | "gateway" | "both"
  create: (options) => ({ /* runtime hooks */ }),
};
```

### Loading

At startup, the gateway loops over `config.plugins`, does `await import(entry.package)`, validates the `.manifest` export, calls `.create()` with config, and registers the result. That's it.

### Dockerfile

Copy all workspace packages at once. Unused plugins sit inert — they're never `import()`-ed if not in config. The cost is negligible (KB of source), and it eliminates per-plugin Dockerfile maintenance.

### Principles

- **Predictable**: one manifest export, one config list, one loading loop
- **No magic**: standard Node.js workspace resolution, standard dynamic imports
- **Easy to understand**: a new plugin is a package with a `manifest` export and a line in config
- **Copy everything, load selectively**: Docker copies all packages; only configured ones are imported

## Key Cases

- **Adding a new plugin**: Create workspace package, export `manifest`, add one line to `lucy.config.json`. No gateway code changes.
- **Plugin with both runtime + gateway hooks**: Manifest declares `type: "both"`, factory returns both hook sets. Single package, single config entry.
- **Plugin with typed config**: `PluginManifest<WhatsAppConfig>` — plugin author defines config type, gets autocomplete in the factory. Config from `lucy.config.json` is passed through.
- **Zero-config plugin**: Just `{ "package": "agents-logging" }` — no `config` key needed.
- **Plugin not in workspace**: Loader throws at startup: `"Plugin 'agents-foo' could not be imported. Is it in the workspace?"`
- **Plugin missing manifest export**: Loader throws: `"Package 'agents-foo' does not export a manifest."`

## Out of Scope

- **External/non-workspace plugins**: Only workspace packages. No npm registry, no remote loading.
- **Hot-reloading**: Plugins load once at startup.
- **Plugin dependency ordering**: Config array order determines init order. No automatic dependency resolution.
- **Plugin marketplace or discovery UI**: Config file only.

## Decisions

- **Named export `manifest`** over default export — explicit, grep-friendly, allows packages to export other things too.
- **Flat `plugins` array** over nested per-tier config — simpler mental model, one place to look.
- **Config array order = init order** — explicit, no hidden dependency graph.
- **Copy everything in Docker** — the runtime cost of unused source files is negligible vs the complexity of selective builds.

## References

- Current plugin types: `agents-runtime/src/types/plugins.ts`
- Current gateway registries: `agents-gateway-http/src/plugins.ts`, `agents-gateway-http/src/gateway-plugins/plugins.ts`
- Current config loading: `agents-runtime/src/config/load-config.ts`
- Dockerfile: `Dockerfile`
- Config example: `lucy.config.example.json`
- Reference architecture: `../open-mercato` (module system with `ModuleEntry[]` and workspace resolution)
