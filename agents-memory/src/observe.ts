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

  // Read items JSONL directly from disk (flat layout: items.jsonl)
  const itemsPath = join(dataDir, "items.jsonl");
  let lines: string[];
  try {
    const raw = await readFile(itemsPath, "utf-8");
    lines = raw.split("\n").filter((l) => l.trim().length > 0);
  } catch {
    return; // no items file yet
  }

  if (lines.length <= lastProcessed) return; // nothing new

  // Parse new items
  const newItems: Item[] = lines
    .slice(lastProcessed)
    .map((line) => JSON.parse(line));

  if (newItems.length === 0) return;

  // Format transcript
  const transcript = formatTranscript(newItems);
  if (!transcript.trim()) {
    // Only system messages or empty — advance cursor anyway
    cursor.agents[agentId] = lines.length;
    await writeCursor(dataDir, cursor);
    return;
  }

  // Extract observations via LLM
  const { text } = await generateText({
    model,
    system: EXTRACTION_PROMPT,
    prompt: transcript,
  });

  // Parse and validate
  const extracted = parseExtractionResponse(text, agentId);

  // Filter out discards, store the rest
  const toStore = extracted.filter((o) => o.gate !== "discard");
  if (toStore.length > 0) {
    await appendObservations(dataDir, toStore);
  }

  // Advance cursor only after successful extraction
  cursor.agents[agentId] = lines.length;
  await writeCursor(dataDir, cursor);
}
