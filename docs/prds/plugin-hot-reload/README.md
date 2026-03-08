---
status: draft
date: 2026-03-08
author: kuba
gh-issue: ""
---

# Plugin hot-reload — reload plugins and config without process restart

## Problem

When running in Docker or production, changing plugin configuration or plugin code requires a full process restart (container rebuild for code, process restart for config). During local development, `tsx --watch` handles code changes by restarting the entire process, but this is blunt — it restarts everything even if only one plugin changed. There's no way to add, remove, or reconfigure a plugin at runtime.

## Proposed Solution

Two levels of hot-reload, each with different complexity:

**Level 1 — Config reload (simpler):** Add a `SIGHUP` handler that re-reads `lucy.config.json`, diffs the plugin list against the running state, and applies changes: destroy removed plugins, init new ones, pass updated config to existing ones. Runtime plugins (hook arrays) are straightforward to splice. Gateway plugins that register Hono routes are harder since Hono has no `unroute()`.

**Level 2 — Code reload (harder):** Node.js ESM modules are cached and immutable once loaded. Re-importing the same package returns the cached version. Options include cache-busting with query strings (`import("agents-memory?t=123")`), worker threads per plugin, or simply deferring to process restart (the pragmatic choice).

## Key Cases

- **Config change — add a plugin:** New entry in `plugins` array, loader imports it, calls `onInit`
- **Config change — remove a plugin:** Entry removed, call `onDestroy`, unregister from hook arrays
- **Config change — update plugin config:** Same plugin, different `config` object — call `onDestroy` then `onInit` with new config (restart the plugin)
- **Code change (local dev):** Plugin source modified — process restart via `tsx --watch` is probably sufficient
- **Gateway plugin route cleanup:** A removed gateway plugin's Hono routes must not respond anymore

## Out of Scope

- Hot-reloading the runtime core (`agents-runtime`) itself — only plugins
- Hot-reloading in production Docker containers without restart — config reload via SIGHUP is the max ambition
- Plugin dependency management during reload (if plugin A depends on plugin B, reload ordering)

## Open Questions

- Is `SIGHUP`-based config reload enough, or do we need a file watcher (`fs.watch`)?
- Can Hono routes be unregistered, or do we need to rebuild the app instance?
- Is ESM cache-busting (`?t=timestamp`) reliable across Node versions, or is it a hack?
- Should plugins have a `onConfigChange` hook instead of full destroy/init cycle?

## References

- Plugin package system PRD: `docs/prds/plugin-package-system/`
- Dynamic loader: `agents-runtime/src/plugins/loader.ts`
- Gateway entry point: `agents-gateway-http/src/index.ts`
- Node.js ESM loader docs: module cache behavior
