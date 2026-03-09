import { Hono } from "hono";
import { cors } from "hono/cors";

import { CORS_ORIGIN } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
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

app.route("/api", health);

app.use("/api/chat", apiKeyAuth);
app.use("/api/chat/*", apiKeyAuth);
app.use("/api/models", apiKeyAuth);
app.route("/api", chat);

app.onError(errorHandler);
app.notFound(notFoundHandler);
