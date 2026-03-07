import { Hono } from "hono";

import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import chat from "./routes/chat.js";
import health from "./routes/health.js";
import sessions from "./routes/sessions.js";

export const app = new Hono();

app.route("/", chat);
app.route("/", health);
app.route("/", sessions);

app.onError(errorHandler);
app.notFound(notFoundHandler);
