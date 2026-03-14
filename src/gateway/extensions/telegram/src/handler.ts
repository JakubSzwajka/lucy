import type { AgentRuntime } from "agents-runtime";

import type { TelegramConfig } from "./config.js";
import type { DedupCache } from "./dedup-cache.js";
import { splitMessage } from "./message-splitter.js";
import type { TelegramClient } from "./telegram-client.js";

export interface HandlerDeps {
  client: TelegramClient;
  config: TelegramConfig;
  dedup: DedupCache;
  runtime: AgentRuntime;
}

export async function handleInboundMessage(
  deps: HandlerDeps,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  if (deps.config.chatId != null && deps.config.chatId !== chatId) {
    console.log(`[telegram] blocked: chat ${chatId} not matching configured TELEGRAM_CHAT_ID`);
    return;
  }

  if (deps.dedup.isDuplicate(String(messageId))) {
    console.log(`[telegram] skipped duplicate: ${messageId}`);
    return;
  }

  const start = Date.now();

  try {
    const result = await deps.runtime.sendMessage(text);
    const chunks = splitMessage(result.response);
    for (const chunk of chunks) {
      await deps.client.sendMessage(chatId, chunk);
    }
    console.log(`[telegram] chat=${chatId} ${result.response.length} chars ${chunks.length} chunk(s) ${Date.now() - start}ms`);
  } catch (error) {
    console.error(`[telegram] chat=${chatId} failed after ${Date.now() - start}ms:`, error);
    await deps.client.sendMessage(chatId, "Something went wrong, try again.");
  }
}
