import type { AgentRuntime } from "agents-runtime";

import type { WhatsAppPluginConfig } from "./config.js";
import type { DedupCache } from "./dedup-cache.js";
import { splitMessage } from "./message-splitter.js";
import type { WhatsAppClient } from "./whatsapp-client.js";

export interface HandlerDeps {
  client: WhatsAppClient;
  config: WhatsAppPluginConfig;
  dedup: DedupCache;
  runtime: AgentRuntime;
}

export async function handleInboundMessage(
  deps: HandlerDeps,
  from: string,
  messageId: string,
  text: string,
): Promise<void> {
  if (!deps.config.allowedNumbers.includes(from)) {
    console.log(`[whatsapp] blocked: ${from} not in allowedNumbers`);
    return;
  }

  if (deps.dedup.isDuplicate(messageId)) {
    console.log(`[whatsapp] skipped duplicate: ${messageId}`);
    return;
  }

  const start = Date.now();

  try {
    const result = await deps.runtime.sendMessage(text);
    const chunks = splitMessage(result.response);
    for (const chunk of chunks) {
      await deps.client.sendTextMessage(from, chunk);
    }
    console.log(`[whatsapp] from=${from} ${result.response.length} chars ${chunks.length} chunk(s) ${Date.now() - start}ms`);
  } catch (error) {
    console.error(`[whatsapp] from=${from} failed after ${Date.now() - start}ms:`, error);
    await deps.client.sendTextMessage(from, "Something went wrong, try again.");
  }
}
