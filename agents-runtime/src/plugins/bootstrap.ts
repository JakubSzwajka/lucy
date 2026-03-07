import { AgentRuntime } from "../runtime/agent-runtime.js";
import type { BootstrapAgentRuntimeOptions } from "../types.js";
import { resolveRuntimePlugins } from "./registry.js";

export async function bootstrapAgentRuntime(
  options: BootstrapAgentRuntimeOptions = {},
): Promise<AgentRuntime> {
  const runtime = new AgentRuntime({
    config: options.config,
    deps: options.deps,
    resolvedPlugins: resolveRuntimePlugins(options.config, options.pluginRegistry),
  });
  await runtime.init();
  return runtime;
}

export async function createConfiguredRuntime(
  options: BootstrapAgentRuntimeOptions = {},
): Promise<AgentRuntime> {
  return bootstrapAgentRuntime(options);
}
