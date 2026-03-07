import { serve } from "@hono/node-server";

import { destroyRuntime, initRuntime } from "./runtime.js";
import { app } from "./server.js";

const port = Number(process.env.PORT ?? 3080);

await initRuntime();

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Gateway listening on http://localhost:${port}`);
});

async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await destroyRuntime();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
