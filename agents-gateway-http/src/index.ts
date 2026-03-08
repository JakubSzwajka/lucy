import { serve } from "@hono/node-server";

import { setGatewayConfig } from "./gateway-config.js";
import { destroyGatewayPlugins, initGatewayPlugins } from "./gateway-plugins/lifecycle.js";
import { destroyRuntime, initRuntime } from "./runtime.js";
import { app } from "./server.js";

const port = Number(process.env.PORT ?? 3080);

const { runtime, config, gatewayPlugins } = await initRuntime();

const gatewayConfig = config["agents-gateway-http"];
if (gatewayConfig) {
  setGatewayConfig(gatewayConfig);
}

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
