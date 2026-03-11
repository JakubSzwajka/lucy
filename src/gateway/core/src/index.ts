import { serve } from "@hono/node-server";

import { loadConfig } from "agents-runtime";
import { createWebUiPlugin } from "../../extensions/webui/src/plugin.js";
import { createLandingPagePlugin } from "../../extensions/landing-page/src/plugin.js";
import { createTelegramPlugin } from "../../extensions/telegram/src/index.js";
import { createWhatsAppPlugin } from "../../extensions/whatsapp/src/index.js";
import { initRuntime, destroyRuntime } from "./runtime.js";
import { app } from "./server.js";

const port = Number(process.env.PORT ?? 3080);
const config = await loadConfig();

const runtime = await initRuntime(config);

// --- Extensions -----------------------------------------------------------

const apiKey = config.gateway?.apiKey ?? process.env.LUCY_API_KEY;
if (apiKey) {
  const { setApiKey } = await import("./middleware/auth.js");
  setApiKey(apiKey);
}

const webui = createWebUiPlugin();
await webui.onInit({ app });

const landing = createLandingPagePlugin();
await landing.onInit({ app });

if (config.whatsapp) {
  const whatsapp = createWhatsAppPlugin();
  await whatsapp.onInit({ app, runtime, config: config.whatsapp });
}

if (config.telegram) {
  const telegram = createTelegramPlugin();
  await telegram.onInit({ app, runtime, config: config.telegram });
}

// --- Server ---------------------------------------------------------------

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[gateway] listening on http://localhost:${port}`);
});

async function shutdown() {
  console.log("[gateway] shutting down...");
  server.close();
  await destroyRuntime();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
