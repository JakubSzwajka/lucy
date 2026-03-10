import { existsSync } from "node:fs";
import path from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

export function createWebUiPlugin() {
  return {
    onInit({ app }: { app: Hono }) {
      const distDir = path.resolve(import.meta.dirname, "../dist");

      if (!existsSync(distDir)) {
        console.log("[webui] dist not found, skipping");
        return;
      }

      const root = path.relative(process.cwd(), distDir);

      app.use("/chat/*", serveStatic({ root, rewriteRequestPath: (p) => p.replace(/^\/chat/, "") }));
      app.use("/chat/*", serveStatic({ root, rewriteRequestPath: () => "/index.html" }));
      app.get("/chat", (c) => c.redirect("/chat/"));

      console.log("[webui] initialized");
    },
  };
}
