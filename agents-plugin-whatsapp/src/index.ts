import type { AgentRuntime } from "agents-runtime";
import type { GatewayPlugin, GatewayPluginInitInput, GatewayPluginManifest } from "agents-gateway-http/plugin";
import type { Hono } from "hono";

import type { WhatsAppPluginConfig } from "./config.js";
import { DedupCache } from "./dedup-cache.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { WhatsAppClient } from "./whatsapp-client.js";

export type { WhatsAppPluginConfig } from "./config.js";

export const WHATSAPP_PLUGIN_ID = "whatsapp" as const;

type InitInput = GatewayPluginInitInput<WhatsAppPluginConfig, Hono, AgentRuntime>;

export const manifest: GatewayPluginManifest<WhatsAppPluginConfig> = {
  id: WHATSAPP_PLUGIN_ID,
  type: "gateway",
  create: () => createWhatsAppPlugin(),
};

export function createWhatsAppPlugin(): GatewayPlugin<WhatsAppPluginConfig> {
  let app: InitInput["app"];
  let runtime: InitInput["runtime"];
  let config: WhatsAppPluginConfig;

  return {
    id: WHATSAPP_PLUGIN_ID,

    async onInit({ app: _app, runtime: _runtime, pluginConfig }) {
      const token = process.env.WHATSAPP_API_TOKEN;
      if (!token) {
        throw new Error(
          "WHATSAPP_API_TOKEN environment variable is required",
        );
      }

      app = _app as Hono;
      runtime = _runtime as AgentRuntime;
      config = pluginConfig;

      const client = new WhatsAppClient({ phoneNumberId: config.phoneNumberId, apiToken: token });
      const dedup = new DedupCache();

      const deps = { client, config, dedup, runtime };
      registerWebhookRoutes(app, config, deps);

      console.log("[whatsapp] initialized");
    },

    onDestroy() {
      console.log("[whatsapp] destroyed");
    },
  };
}
