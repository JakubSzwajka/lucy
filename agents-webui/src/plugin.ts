import { existsSync } from "node:fs";
import path from "node:path";

import type { GatewayPlugin, GatewayPluginManifest } from "agents-gateway-http/plugin";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

const WEBUI_PLUGIN_ID = "webui" as const;

export const manifest: GatewayPluginManifest = {
  id: WEBUI_PLUGIN_ID,
  type: "gateway",
  create: () => createWebUiPlugin(),
};

export function createWebUiPlugin(): GatewayPlugin {
  return {
    id: WEBUI_PLUGIN_ID,

    onInit({ app: _app }) {
      const app = _app as Hono;
      const distDir = path.resolve(import.meta.dirname, "../dist");

      if (!existsSync(distDir)) {
        console.log("[webui] dist directory not found, skipping static file serving");
        return;
      }

      const root = path.relative(process.cwd(), distDir);

      app.use("/chat/*", serveStatic({ root, rewriteRequestPath: (p) => p.replace(/^\/chat/, "") }));
      app.use("/chat/*", serveStatic({ root, rewriteRequestPath: () => "/index.html" }));
      app.get("/chat", (c) => c.redirect("/chat/"));

      console.log("[webui] initialized");
    },

    onDestroy() {
      console.log("[webui] destroyed");
    },
  };
}
