import { existsSync } from "node:fs";
import path from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { CORS_ORIGIN } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import chat from "./routes/chat.js";
import health from "./routes/health.js";
import sessions from "./routes/sessions.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: CORS_ORIGIN }));

app.route("/", chat);
app.route("/", health);
app.route("/", sessions);

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
