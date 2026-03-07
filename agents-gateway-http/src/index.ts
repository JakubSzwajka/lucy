import { serve } from "@hono/node-server";

import { initRuntime } from "./runtime.js";
import { app } from "./server.js";

const port = Number(process.env.PORT ?? 3080);

await initRuntime();

serve({ fetch: app.fetch, port }, () => {
  console.log(`Gateway listening on http://localhost:${port}`);
});
