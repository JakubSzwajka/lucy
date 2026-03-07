# Type domains

Splits the `agents-runtime` type surface by responsibility so runtime and plugin code do not depend on one monolithic file.

## Files

- `domain.ts` - persisted agent, session, item, model, config, and identity shapes
- `plugins.ts` - runtime plugin contract, hook inputs, and config types
- `runtime.ts` - runtime bootstrap, deps, context, and run result types
- `../types.ts` - compatibility barrel re-exporting all three files

## Responsibility Boundary

Owns shared type contracts only. Does not implement runtime behavior, plugin lifecycle, or storage adapters.

## Read Next

- [agents-runtime](../../README.md) - package API that re-exports these types
- [Runtime internals](../runtime/README.md) - code that consumes runtime/domain types
- [Plugin system](../plugins/README.md) - code that consumes plugin types
