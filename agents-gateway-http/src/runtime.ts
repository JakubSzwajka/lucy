import { bootstrapAgentRuntime, createFileAdapters, loadConfig, type AgentRuntime } from "agents-runtime";

import { DATA_DIR } from "./config.js";
import { buildPluginRegistry } from "./plugins.js";

let runtime: AgentRuntime | null = null;

export async function initRuntime(): Promise<AgentRuntime> {
  if (runtime) return runtime;

  const lucyConfig = await loadConfig();

  runtime = await bootstrapAgentRuntime({
    config: lucyConfig["agents-runtime"],
    deps: createFileAdapters(DATA_DIR),
    pluginRegistry: buildPluginRegistry(),
  });

  return runtime;
}

export function getRuntime(): AgentRuntime {
  if (!runtime) {
    throw new Error("Runtime not initialized. Call initRuntime() first.");
  }
  return runtime;
}

export async function destroyRuntime(): Promise<void> {
  if (!runtime) return;
  await runtime.destroy();
  runtime = null;
}
