import type { AgentRuntime } from "agents-runtime";
import type { Hono } from "hono";

import type { ResolvedGatewayPlugin } from "../types/gateway-plugins.js";

export async function initGatewayPlugins(
  resolvedPlugins: ResolvedGatewayPlugin[],
  app: Hono,
  runtime: AgentRuntime,
): Promise<void> {
  for (const resolvedPlugin of resolvedPlugins) {
    await resolvedPlugin.plugin.onInit?.({
      app,
      pluginConfig: resolvedPlugin.config,
      runtime,
    });
  }
}

export async function destroyGatewayPlugins(
  resolvedPlugins: ResolvedGatewayPlugin[],
): Promise<void> {
  for (const resolvedPlugin of resolvedPlugins) {
    await resolvedPlugin.plugin.onDestroy?.();
  }
}
