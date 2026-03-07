# Runtime internals

Owns the `AgentRuntime` execution path after bootstrap has already resolved dependencies and plugins.

## Files

- `agent-runtime.ts` - public runtime class, session helpers, and top-level orchestration
- `context.ts` - builds `ChatContext` from agent state, model config, environment, identity, and plugin prompt sections
- `execution.ts` - streaming/non-streaming run loops, step persistence, and terminal run finalization

## Responsibility Boundary

Owns runtime behavior for running agents. Delegates plugin hook execution to `../plugins`, persistence to runtime ports, and type definitions to `../types`.

## Read Next

- [agents-runtime](../../README.md) - package API and bootstrap entrypoints
- [Plugin system](../plugins/README.md) - how resolved plugins are invoked around runtime execution
- [Type domains](../types/README.md) - runtime-facing type contracts
