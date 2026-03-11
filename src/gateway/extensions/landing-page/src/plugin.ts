import { existsSync } from "node:fs";
import path from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

export function createLandingPagePlugin() {
  return {
    onInit({ app }: { app: Hono }) {
      const distDir = path.resolve(import.meta.dirname, "../dist");

      if (!existsSync(distDir)) {
        console.log("[landing-page] dist not found, skipping");
        return;
      }

      const root = path.relative(process.cwd(), distDir);
      app.use("/*", serveStatic({ root, index: "index.html" }));

      console.log("[landing-page] initialized");
    },
  };
}
