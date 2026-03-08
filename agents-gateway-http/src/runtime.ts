import {
  AgentRuntime,
  createFileAdapters,
  loadConfig,
  loadPlugins,
  type LucyConfig,
  type ResolvedGatewayPlugin,
} from "agents-runtime";

import { DATA_DIR } from "./config.js";

let runtime: AgentRuntime | null = null;

export async function initRuntime(): Promise<{
  runtime: AgentRuntime;
  config: LucyConfig;
  gatewayPlugins: ResolvedGatewayPlugin[];
}> {
  const lucyConfig = await loadConfig();

  if (runtime) return { runtime, config: lucyConfig, gatewayPlugins: [] };

  const loaded = await loadPlugins(lucyConfig.plugins);

  runtime = new AgentRuntime({
    config: lucyConfig["agents-runtime"],
    deps: createFileAdapters(DATA_DIR),
    resolvedPlugins: loaded.runtime,
  });
  await runtime.init();

  return { runtime, config: lucyConfig, gatewayPlugins: loaded.gateway };
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
