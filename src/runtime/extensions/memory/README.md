---
title: Memory Plugin
section: Runtime
subsection: Extensions
order: 10
---

# agents-memory

Proof runtime plugin package implementing the `agents-runtime` plugin contract.

## Status

Thin proof plugin. This package demonstrates the public `agents-runtime` plugin contract; it is not a durable memory system.

## Public API

- `MEMORY_PLUGIN_ID` - canonical plugin id used in runtime registries and `config.plugins.enabled`
- `createMemoryPlugin(...)` - creates a runtime plugin that contributes prompt context and observes terminal runs
- `MemoryPluginConfig` - minimal config passed from `runtime.config.plugins.configById.memory`
- `MemoryContextRecord` - small memory block shape rendered into the runtime system prompt
- `MemoryPluginContext` - plugin-local in-memory state
- `MemoryPluginRunCompleteInput` - typed run summary input for observation callbacks

## Install Through Runtime Config

```ts
import { createMemoryPlugin } from "agents-memory";
import { bootstrapAgentRuntime } from "agents-runtime";

const runtime = bootstrapAgentRuntime({
  config: {
    plugins: {
      enabled: ["memory"],
      configById: {
        memory: {
          initialMemory: {
            content: "User prefers concise updates and direct tradeoff summaries.",
          },
        },
      },
    },
  },
  pluginRegistry: {
    memory: createMemoryPlugin(),
  },
});
```

The runtime only installs the plugin when `"memory"` is enabled in config. `bootstrapAgentRuntime(...)` is the primary runtime entrypoint; `createConfiguredRuntime(...)` remains an equivalent alias in `agents-runtime` for compatibility.

This plugin intentionally treats `onRunObserved(...)` as best-effort. The callback still runs after terminal completions, but any callback error is swallowed inside the plugin so the scaffold does not turn runtime hook failures into user-visible run failures.

This package owns the plugin implementation only; `agents-runtime` owns selection, ordering, and hook execution. The runtime smoke test exercises both the no-plugin baseline and the configured memory-plugin path.

## Responsibility Boundary

Owns memory-specific plugin code and related types. Does not implement durable storage, extraction, ranking, retrieval, or background processing.

## Read Next

- [agents-runtime](../../core/README.md) - runtime bootstrap, plugin resolution, and execution ownership
