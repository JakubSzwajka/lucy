import { AgentRuntime } from "../runtime/agent-runtime.js";
import type { BootstrapAgentRuntimeOptions } from "../types.js";
import { resolveRuntimePlugins } from "./registry.js";

export function bootstrapAgentRuntime(
  options: BootstrapAgentRuntimeOptions = {},
): AgentRuntime {
  return new AgentRuntime({
    config: options.config,
    deps: options.deps,
    resolvedPlugins: resolveRuntimePlugins(options.config, options.pluginRegistry),
  });
}

export function createConfiguredRuntime(
  options: BootstrapAgentRuntimeOptions = {},
): AgentRuntime {
  return bootstrapAgentRuntime(options);
}
