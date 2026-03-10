import {
  AgentRuntime,
  loadConfig,
  type LucyConfig,
} from "agents-runtime";

import { loadGatewayPlugins } from "./gateway-plugins/loader.js";
import type { ResolvedGatewayPlugin } from "./types/gateway-plugins.js";

let runtime: AgentRuntime | null = null;

export async function initRuntime(): Promise<{
  runtime: AgentRuntime;
  config: LucyConfig;
  gatewayPlugins: ResolvedGatewayPlugin[];
}> {
  const lucyConfig = await loadConfig();

  if (runtime) return { runtime, config: lucyConfig, gatewayPlugins: [] };

  const gatewayPlugins = await loadGatewayPlugins(lucyConfig.plugins);

  runtime = new AgentRuntime({ config: lucyConfig["agents-runtime"] });
  await runtime.init();

  return { runtime, config: lucyConfig, gatewayPlugins };
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
