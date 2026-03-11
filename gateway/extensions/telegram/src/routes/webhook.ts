import type { Hono } from "hono";

import type { HandlerDeps } from "../handler.js";
import { handleInboundMessage } from "../handler.js";

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
}

export function registerWebhookRoutes(app: Hono, deps: HandlerDeps): void {
  app.post("/telegram/webhook", async (c) => {
    const body: TelegramUpdate = await c.req.json();

    processUpdate(body, deps).catch((error) => {
      console.error("[telegram] webhook error:", error);
    });

    return c.text("OK", 200);
  });
}

async function processUpdate(body: TelegramUpdate, deps: HandlerDeps): Promise<void> {
  const message = body?.message;
  if (!message?.text) return;

  await handleInboundMessage(deps, message.chat.id, message.message_id, message.text);
}
