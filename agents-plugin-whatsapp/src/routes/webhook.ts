import type { Hono } from "hono";

import type { WhatsAppPluginConfig } from "../config.js";
import type { HandlerDeps } from "../handler.js";
import { handleInboundMessage } from "../handler.js";

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

export function registerWebhookRoutes(
  app: Hono,
  config: WhatsAppPluginConfig,
  deps: HandlerDeps,
): void {
  app.get("/whatsapp/webhook", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");

    if (mode === "subscribe" && token === config.verifyToken) {
      return c.text(challenge ?? "", 200);
    }

    return c.text("Forbidden", 403);
  });

  app.post("/whatsapp/webhook", async (c) => {
    const body = await c.req.json();

    const hasMessages = body?.entry?.some((e: any) =>
      e?.changes?.some((c: any) => Array.isArray(c?.value?.messages)),
    );

    if (hasMessages) {
      console.log("[whatsapp] inbound message webhook received");
    }

    processWebhook(body, deps).catch((error) => {
      console.error("[whatsapp] webhook processing error:", error);
    });

    return c.text("OK", 200);
  });
}

async function processWebhook(body: WebhookPayload, deps: HandlerDeps): Promise<void> {
  const entries = body?.entry;
  if (!Array.isArray(entries)) return;

  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const messages = change?.value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const message of messages) {
        console.log(`[whatsapp] message from=${message.from} type=${message.type} id=${message.id}`);
        if (message.type === "text" && message.text?.body) {
          await handleInboundMessage(
            deps,
            message.from,
            message.id,
            message.text.body,
          );
        }
      }
    }
  }
}
