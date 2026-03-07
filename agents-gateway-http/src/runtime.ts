import {
  bootstrapAgentRuntime,
  createFileAdapters,
  loadConfig,
  type AgentRuntime,
  type LucyConfig,
} from "agents-runtime";

import { DATA_DIR } from "./config.js";
import { buildPluginRegistry } from "./plugins.js";

let runtime: AgentRuntime | null = null;

export async function initRuntime(): Promise<{ runtime: AgentRuntime; config: LucyConfig }> {
  const lucyConfig = await loadConfig();

  if (runtime) return { runtime, config: lucyConfig };

  runtime = await bootstrapAgentRuntime({
    config: lucyConfig["agents-runtime"],
    deps: createFileAdapters(DATA_DIR),
    pluginRegistry: buildPluginRegistry(),
  });

  return { runtime, config: lucyConfig };
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
