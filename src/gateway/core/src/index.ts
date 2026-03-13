import { serve } from "@hono/node-server";

import { createWebUiPlugin } from "../../extensions/webui/src/plugin.js";
import { createLandingPagePlugin } from "../../extensions/landing-page/src/plugin.js";
import { createTelegramPlugin } from "../../extensions/telegram/src/index.js";
import { initRuntime, destroyRuntime } from "./runtime.js";
import { app } from "./server.js";

const port = Number(process.env.PORT ?? 3080);

const runtime = await initRuntime();

// --- Auth ----------------------------------------------------------------

const apiKey = process.env.LUCY_API_KEY;
if (apiKey) {
  const { setApiKey } = await import("./middleware/auth.js");
  setApiKey(apiKey);
}

// --- Extensions -----------------------------------------------------------

const webui = createWebUiPlugin();
await webui.onInit({ app });

const landing = createLandingPagePlugin();
await landing.onInit({ app });

if (process.env.TELEGRAM_BOT_TOKEN) {
  const telegram = createTelegramPlugin();
  await telegram.onInit({
    app,
    runtime,
    config: {
      chatId: process.env.TELEGRAM_CHAT_ID
        ? Number(process.env.TELEGRAM_CHAT_ID.trim())
        : undefined,
    },
  });
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
