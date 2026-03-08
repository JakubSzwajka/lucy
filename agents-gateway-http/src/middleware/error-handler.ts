import type { Context } from "hono";

export function errorHandler(err: Error, c: Context) {
  console.error("[gateway] unhandled error:", err);

  if (err.message.includes("not found") || err.message.includes("Not found")) {
    return c.json({ error: err.message }, 404);
  }

  return c.json({ error: err.message || "Internal server error" }, 500);
}

export function notFoundHandler(c: Context) {
  return c.json({ error: "Not found" }, 404);
}
