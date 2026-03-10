import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { generateText, type LanguageModel } from "ai";

import { EXTRACTION_PROMPT, parseExtractionResponse } from "./extract.js";
import { appendObservations } from "./store.js";
import { formatTranscript } from "./transcript.js";

/**
 * Run the observation pipeline on a set of agent messages.
 * Extracts observations via LLM and stores results.
 */
export async function observe(
  dataDir: string,
  messages: AgentMessage[],
  model: LanguageModel,
): Promise<void> {
  const transcript = formatTranscript(messages);
  if (!transcript.trim()) {
    console.log("[memory] no extractable content");
    return;
  }

  const { text } = await generateText({
    model,
    system: EXTRACTION_PROMPT,
    prompt: transcript,
  });

  const extracted = parseExtractionResponse(text, "agent");
  const toStore = extracted.filter((o) => o.gate !== "discard");
  if (toStore.length > 0) {
    await appendObservations(dataDir, toStore);
  }

  console.log(
    `[memory] observed ${messages.length} messages, extracted ${toStore.length} observations`,
  );
}
