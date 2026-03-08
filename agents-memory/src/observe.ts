import { generateText, type LanguageModel } from "ai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Item } from "agents-runtime";

import { readCursor, writeCursor } from "./cursor.js";
import { EXTRACTION_PROMPT, parseExtractionResponse } from "./extract.js";
import { appendObservations } from "./store.js";
import { formatTranscript } from "./transcript.js";

/**
 * Run the observation loop for a specific agent.
 * Reads new items since last cursor, extracts observations via LLM, stores results.
 * On failure, cursor is NOT advanced — next run retries the same items.
 */
export async function observe(
  dataDir: string,
  agentId: string,
  model: LanguageModel,
): Promise<void> {
  const cursor = await readCursor(dataDir);
  const lastProcessed = cursor.agents[agentId] ?? 0;

  const itemsPath = join(dataDir, "items.jsonl");
  let allItems: Item[];
  try {
    const raw = await readFile(itemsPath, "utf-8");
    allItems = raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return;
  }

  const agentItems = allItems.filter((item) => item.agentId === agentId);
  const totalForAgent = agentItems.length;

  if (totalForAgent <= lastProcessed) {
    console.log(`[memory] no new items for agent ${agentId}`);
    return;
  }

  const newItems = agentItems.slice(lastProcessed);

  const transcript = formatTranscript(newItems);
  if (!transcript.trim()) {
    console.log(`[memory] no extractable content for agent ${agentId}`);
    cursor.agents[agentId] = totalForAgent;
    await writeCursor(dataDir, cursor);
    return;
  }

  const { text } = await generateText({
    model,
    system: EXTRACTION_PROMPT,
    prompt: transcript,
  });

  const extracted = parseExtractionResponse(text, agentId);

  const toStore = extracted.filter((o) => o.gate !== "discard");
  if (toStore.length > 0) {
    await appendObservations(dataDir, toStore);
  }

  console.log(
    `[memory] observed ${newItems.length} new items for agent ${agentId}, extracted ${toStore.length} observations`,
  );

  cursor.agents[agentId] = totalForAgent;
  await writeCursor(dataDir, cursor);
}
