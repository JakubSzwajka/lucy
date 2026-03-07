import { serve } from "@hono/node-server";

import { destroyGatewayPlugins, initGatewayPlugins } from "./gateway-plugins/lifecycle.js";
import { buildGatewayPluginRegistry } from "./gateway-plugins/plugins.js";
import { resolveGatewayPlugins } from "./gateway-plugins/registry.js";
import { destroyRuntime, initRuntime } from "./runtime.js";
import { app } from "./server.js";
import type { GatewayPluginsConfig, ResolvedGatewayPlugin } from "./types/gateway-plugins.js";

const port = Number(process.env.PORT ?? 3080);

const { runtime, config } = await initRuntime();

const gatewayConfig = config["agents-gateway-http"];
const gatewayPlugins: ResolvedGatewayPlugin[] = resolveGatewayPlugins(
  gatewayConfig?.plugins as GatewayPluginsConfig | undefined,
  buildGatewayPluginRegistry(),
);

await initGatewayPlugins(gatewayPlugins, app, runtime);

if (gatewayPlugins.length > 0) {
  console.log(
    `Gateway plugins loaded: ${gatewayPlugins.map((p) => p.plugin.id).join(", ")}`,
  );
}

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Gateway listening on http://localhost:${port}`);
});

async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await destroyGatewayPlugins(gatewayPlugins);
  await destroyRuntime();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
