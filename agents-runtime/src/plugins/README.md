# Plugin system

Owns how installed plugins are selected from config and how their hooks are run.

## Files

- `registry.ts` - resolves `config.plugins.enabled` against the installed plugin registry and validates ids
- `bootstrap.ts` - builds a configured `AgentRuntime` from deps, runtime config, and the installed registry
- `lifecycle.ts` - runs `prepareContext` and `onRunComplete` hooks in resolved order

## Responsibility Boundary

Owns plugin selection, ordering, and invocation. Does not implement plugin-specific behavior; concrete plugins live in other packages such as `agents-memory`.

## Read Next

- [agents-runtime](../../README.md) - public plugin/bootstrap API
- [Runtime internals](../runtime/README.md) - runtime flow that consumes resolved plugins
- [Type domains](../types/README.md) - plugin contract and config types
