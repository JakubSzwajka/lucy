// ---------------------------------------------------------------------------
// Anamnesis — Reflection Pipeline (session_before_compact)
// ---------------------------------------------------------------------------
// Thin orchestrator for the three reflection phases:
//   1. Foresight  — did prior predictions come true?
//   2. Extract    — classify, score, generate via LLM
//   3. Integrate  — evolve memories, persist, journal
// ---------------------------------------------------------------------------

import { serializeConversation, convertToLlm } from "@mariozechner/pi-coding-agent";
import { checkForesight } from "../src/foresight.js";
import { runReflection as extract } from "../src/orchestrator.js";
import { integrate } from "../src/integrate.js";
import { initStore, loadMemories } from "../src/store.js";

const MIN_MESSAGES = 2;

let storeInitialized = false;
async function ensureStore(): Promise<void> {
  if (!storeInitialized) {
    await initStore();
    storeInitialized = true;
  }
}

export async function runReflection(event: any): Promise<any> {
  await ensureStore();
  const { preparation } = event;

  // Serialize conversation
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize),
  );
  const userMsgCount = (conversationText.match(/^\[User\]:/gm) || []).length;
  console.log(
    `[anamnesis] reflection: ${preparation.messagesToSummarize.length} messages, ${userMsgCount} user, ${preparation.tokensBefore} tokens`,
  );

  if (userMsgCount < MIN_MESSAGES) {
    console.log(`[anamnesis] below threshold (${MIN_MESSAGES}), skipping reflection`);
    return; // Let Pi handle compaction with its default summary
  }

  // Phase 1: Foresight — check prior predictions
  try {
    await checkForesight(conversationText);
  } catch (err) {
    console.log(`[anamnesis] foresight failed: ${(err as Error).message}`);
  }

  // Phase 2: Extract — classify, score, generate
  const existingMemories = await loadMemories();
  const result = await extract(conversationText, existingMemories);

  // Phase 3: Integrate — evolve, persist, journal
  const { evolution } = await integrate(result, conversationText);

  console.log(
    `[anamnesis] reflection complete: ${result.memories.length} memories (${evolution.added.length} new), ${result.questions.length} questions — handing off to Pi for compaction summary`,
  );

  // Return nothing — Pi SDK generates its own narrative compaction summary
}
