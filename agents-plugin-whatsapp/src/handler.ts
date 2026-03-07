import type { AgentRuntime } from "agents-runtime";

import type { WhatsAppPluginConfig } from "./config.js";
import type { DedupCache } from "./dedup-cache.js";
import { splitMessage } from "./message-splitter.js";
import type { PhoneSessionStore } from "./session-store.js";
import type { WhatsAppClient } from "./whatsapp-client.js";

export interface HandlerDeps {
  client: WhatsAppClient;
  config: WhatsAppPluginConfig;
  dedup: DedupCache;
  runtime: AgentRuntime;
  sessionStore: PhoneSessionStore;
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

  console.log(`[whatsapp] processing: from=${from} text="${text}"`);

  try {
    const sessionId = await deps.sessionStore.getOrCreateSession(from);
    console.log(`[whatsapp] session=${sessionId}, sending to runtime...`);
    const result = await deps.runtime.sendMessage(sessionId, text);
    console.log(`[whatsapp] runtime responded (${result.response.length} chars)`);
    const chunks = splitMessage(result.response);
    for (const chunk of chunks) {
      await deps.client.sendTextMessage(from, chunk);
    }
    console.log(`[whatsapp] reply sent (${chunks.length} chunk(s))`);
  } catch (error) {
    console.error("[whatsapp] message handling failed:", error);
    await deps.client.sendTextMessage(from, "Something went wrong, try again.");
  }
}
