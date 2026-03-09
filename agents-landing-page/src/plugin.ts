import { existsSync } from "node:fs";
import path from "node:path";

import type { GatewayPlugin, GatewayPluginManifest } from "agents-runtime";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

const LANDING_PAGE_PLUGIN_ID = "landing-page" as const;

export const manifest: GatewayPluginManifest = {
  id: LANDING_PAGE_PLUGIN_ID,
  type: "gateway",
  create: () => createLandingPagePlugin(),
};

export function createLandingPagePlugin(): GatewayPlugin {
  return {
    id: LANDING_PAGE_PLUGIN_ID,

    onInit({ app: _app }) {
      const app = _app as Hono;
      const distDir = path.resolve(import.meta.dirname, "../dist");

      if (!existsSync(distDir)) {
        console.log("[landing-page] dist directory not found, skipping static file serving");
        return;
      }

      const root = path.relative(process.cwd(), distDir);
      app.use("/*", serveStatic({ root, index: "index.html" }));

      console.log("[landing-page] initialized");
    },

    onDestroy() {
      console.log("[landing-page] destroyed");
    },
  };
}
