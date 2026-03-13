import { Hono } from "hono";
import { cors } from "hono/cors";

import { CORS_ORIGIN } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import chat from "./routes/chat.js";
import health from "./routes/health.js";
import session from "./routes/session.js";
import tasks from "./routes/tasks.js";

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
app.use("/api/session", apiKeyAuth);
app.use("/api/tasks", apiKeyAuth);
app.route("/api", chat);
app.route("/api", session);
app.route("/api", tasks);

app.onError(errorHandler);
app.notFound(notFoundHandler);
