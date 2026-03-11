import type { AgentRuntime } from "agents-runtime";
import type { Hono } from "hono";

import type { TelegramConfig } from "./config.js";
import { DedupCache } from "./dedup-cache.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { TelegramClient } from "./telegram-client.js";

export type { TelegramConfig } from "./config.js";

export function createTelegramPlugin() {
  return {
    async onInit({ app, runtime, config }: { app: Hono; runtime: AgentRuntime; config: TelegramConfig }) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
      }

      const client = new TelegramClient(token);
      const dedup = new DedupCache();

      registerWebhookRoutes(app, { client, config, dedup, runtime });

      console.log("[telegram] initialized");
    },
  };
}
