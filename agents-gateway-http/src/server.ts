import { existsSync } from "node:fs";
import path from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { CORS_ORIGIN } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import chat from "./routes/chat.js";
import health from "./routes/health.js";

export const app = new Hono();

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[gateway] ${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});
app.use("*", cors({ origin: CORS_ORIGIN }));

app.route("/api", chat);
app.route("/api", health);

// Serve WebUI static files at /chat if the dist directory exists
const webUiDir = path.resolve(
  import.meta.dirname,
  "../../agents-webui/dist",
);

if (existsSync(webUiDir)) {
  const webUiRoot = path.relative(process.cwd(), webUiDir);

  // Call 1: serve real static files (JS, CSS, images)
  // Strip /chat prefix so /chat/assets/foo.js resolves to dist/assets/foo.js
  app.use(
    "/chat/*",
    serveStatic({
      root: webUiRoot,
      rewriteRequestPath: (p) => p.replace(/^\/chat/, ""),
    }),
  );

  // Call 2: SPA fallback — serve index.html for any unmatched /chat/* route
  app.use(
    "/chat/*",
    serveStatic({
      root: webUiRoot,
      rewriteRequestPath: () => "/index.html",
    }),
  );

  // Handle bare /chat without trailing slash
  app.get("/chat", (c) => {
    return c.redirect("/chat/");
  });
}

// Serve landing page static files if the dist directory exists
const landingPageDir = path.resolve(
  import.meta.dirname,
  "../../agents-landing-page/dist",
);

if (existsSync(landingPageDir)) {
  app.use(
    "/*",
    serveStatic({
      root: path.relative(process.cwd(), landingPageDir),
      index: "index.html",
    }),
  );
}

app.onError(errorHandler);
app.notFound(notFoundHandler);
