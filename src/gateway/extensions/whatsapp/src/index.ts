import type { AgentRuntime } from "agents-runtime";
import type { Hono } from "hono";

import type { WhatsAppConfig } from "./config.js";
import { DedupCache } from "./dedup-cache.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { WhatsAppClient } from "./whatsapp-client.js";

export type { WhatsAppConfig } from "./config.js";

export function createWhatsAppPlugin() {
  return {
    async onInit({ app, runtime, config }: { app: Hono; runtime: AgentRuntime; config: WhatsAppConfig }) {
      const token = process.env.WHATSAPP_API_TOKEN;
      if (!token) {
        throw new Error("WHATSAPP_API_TOKEN environment variable is required");
      }

      const client = new WhatsAppClient({ phoneNumberId: config.phoneNumberId, apiToken: token });
      const dedup = new DedupCache();

      registerWebhookRoutes(app, config, { client, config, dedup, runtime });

      console.log("[whatsapp] initialized");
    },
  };
}
