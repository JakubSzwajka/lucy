import type { GatewayPlugin, GatewayPluginInitInput } from "agents-gateway-http/types";
import { resolveDataDir } from "agents-runtime";

import type { WhatsAppPluginConfig } from "./config.js";
import { DedupCache } from "./dedup-cache.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { PhoneSessionStore } from "./session-store.js";
import { WhatsAppClient } from "./whatsapp-client.js";

export type { WhatsAppPluginConfig } from "./config.js";

export const WHATSAPP_PLUGIN_ID = "whatsapp" as const;

type InitInput = GatewayPluginInitInput<WhatsAppPluginConfig>;

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

      app = _app;
      runtime = _runtime;
      config = pluginConfig;

      const client = new WhatsAppClient({ phoneNumberId: config.phoneNumberId, apiToken: token });
      const sessionStore = new PhoneSessionStore(runtime, resolveDataDir());
      await sessionStore.load();
      const dedup = new DedupCache();

      const deps = { client, config, dedup, runtime, sessionStore };
      registerWebhookRoutes(app, config, deps);

      console.log("WhatsApp plugin initialized");
    },

    onDestroy() {
      console.log("WhatsApp plugin destroyed");
    },
  };
}
