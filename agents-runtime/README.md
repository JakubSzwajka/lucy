# agents-runtime

Standalone AI agent execution engine using the Vercel AI SDK. Runs agents in streaming or non-streaming mode with pluggable storage, model providers, identity enrichment, and config-resolved runtime plugins.

## Public API

- `AgentRuntime` - main runtime class for sessions, context preparation, and execution
- `bootstrapAgentRuntime(...)` - primary bootstrap entrypoint; builds an `AgentRuntime` from runtime config, deps, and an installed plugin registry
- `createConfiguredRuntime(...)` - compatibility alias for `bootstrapAgentRuntime(...)`
- `resolveRuntimePlugins(...)` - resolves enabled plugin ids from runtime config against an installed plugin registry
- `loadConfig(path?)` - loads `lucy.config.json` (or `LUCY_CONFIG_PATH`) into a typed `LucyConfig`
- `cancelAgent(agentId)` - aborts a running non-streaming agent
- `createFileAdapters(dataDir?)` - file-backed implementations of the runtime ports
- `resolveDataDir(dataDir?)` - resolves the runtime data directory
- `OpenRouterModelProvider` - `ModelProvider` implementation using OpenRouter
- Runtime plugin types - `RuntimePlugin`, `RuntimePluginRegistry`, `RuntimePluginsConfig`, `ResolvedRuntimePlugin`, and hook input/output types

## Plugin Installation

Install plugins in a registry, then let runtime config decide which ones are active for a deployment.

```ts
import { createMemoryPlugin } from "agents-memory";
import {
  bootstrapAgentRuntime,
  type RuntimePluginRegistry,
} from "agents-runtime";

const pluginRegistry: RuntimePluginRegistry = {
  memory: createMemoryPlugin(),
};

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
  pluginRegistry,
});
```

`bootstrapAgentRuntime(...)` is the canonical name in docs and examples. `createConfiguredRuntime(...)` is the same function shape and behavior, kept as a thin alias for callers that already adopted it.

Only plugin ids listed in `config.plugins.enabled` are resolved. Missing ids fail fast during bootstrap. This keeps plugin selection in runtime configuration rather than transport-level wiring. The workspace smoke test covers both the baseline no-plugin runtime path and the configured memory-plugin path end to end.

## Responsibility Boundary

Owns session lifecycle, context assembly, model execution, step persistence, cancellation, and runtime plugin resolution. Delegates storage to port implementations, model resolution to `ModelProvider`, and plugin behavior to installed runtime plugins. It does not own transport-specific tool wiring.

## Read Next

- [Runtime internals](./src/runtime/README.md) - session helpers, context assembly, and execution flow
- [Plugin system](./src/plugins/README.md) - registry resolution, bootstrap, and lifecycle hook orchestration
- [Config loading](./src/config/) - `lucy.config.json` loader and `LucyConfig` type
- [Type domains](./src/types/README.md) - split type surface for domain, runtime, and plugin contracts
- [Adapters](./src/adapters/README.md) - file-based port implementations and OpenRouter provider
- [agents-memory](../agents-memory/README.md) - proof plugin package implementing the runtime contract
