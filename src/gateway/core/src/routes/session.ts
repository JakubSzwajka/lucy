import { Hono } from "hono";

import { getRuntime } from "../runtime.js";

const session = new Hono();

session.get("/session", async (c) => {
  const runtime = getRuntime();
  const info = await runtime.getSessionInfo();
  return c.json(info);
});

export default session;
