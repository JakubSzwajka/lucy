import { timingSafeEqual } from "node:crypto";

import { createMiddleware } from "hono/factory";

import { getApiKey } from "../gateway-config.js";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const configuredKey = getApiKey();

  if (!configuredKey) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  if (!safeEqual(token, configuredKey)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
});
