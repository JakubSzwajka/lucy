// ---------------------------------------------------------------------------
// Anamnesis — Reflection Pipeline (session_before_compact)
// ---------------------------------------------------------------------------
// Runs on compaction: checks foresight predictions, triggers memory
// extraction via orchestrator, evolves memories, writes journal entry.
// ---------------------------------------------------------------------------

import { serializeConversation, convertToLlm } from "@mariozechner/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { buildJournalPrompt, appendJournalEntry } from "../src/journal.js";
import { llmCall } from "../src/llm.js";
import { runReflection as orchestrate } from "../src/orchestrator.js";
import {
  initStore,
  loadMemories,
  evolveMemories,
  addQuestion,
  addPredictions,
  saveReflection,
  loadPredictions,
  savePredictions,
} from "../src/store.js";
import { DISPOSITION_PROFILE_PATH } from "../src/paths.js";

const MIN_MESSAGES = 2;

let storeInitialized = false;

async function ensureStore(): Promise<void> {
  if (!storeInitialized) {
    await initStore();
    storeInitialized = true;
  }
}

// ---------------------------------------------------------------------------
// Foresight — check predictions against conversation
// ---------------------------------------------------------------------------

async function checkForesight(conversationText: string): Promise<void> {
  const predictions = await loadPredictions();
  const pending = predictions.filter((p) => p.status === "pending");
  console.log(`[anamnesis] foresight: ${predictions.length} total predictions, ${pending.length} pending`);

  if (pending.length === 0) return;

  const conversationLower = conversationText.toLowerCase();
  let confirmed = 0;

  for (const pred of pending) {
    const keywords = pred.content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);

    const matches = keywords.filter((kw) => conversationLower.includes(kw));
    const matchRatio = keywords.length > 0 ? matches.length / keywords.length : 0;

    if (matchRatio >= 0.4) {
      pred.status = "confirmed";
      pred.resolved_at = new Date().toISOString().split("T")[0];
      confirmed++;
    }
  }

  if (confirmed === 0) return;

  await savePredictions(predictions);
  console.log(`[anamnesis] foresight: ${confirmed} predictions confirmed`);

  // Append note to disposition profile
  try {
    if (existsSync(DISPOSITION_PROFILE_PATH)) {
      const profile = await readFile(DISPOSITION_PROFILE_PATH, "utf-8");
      const confirmedPreds = pending.filter((p) => p.status === "confirmed");
      const note = confirmedPreds
        .map((p) => `- "${p.content}" — confirmed ${p.resolved_at}`)
        .join("\n");
      const updated = profile.replace(
        "### Active Predictions",
        `### Active Predictions\n\n#### Recently Confirmed\n${note}\n`,
      );
      await writeFile(DISPOSITION_PROFILE_PATH, updated, "utf-8");
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Journal writing
// ---------------------------------------------------------------------------

async function writeJournal(result: {
  memories_extracted: number;
  memories_added: number;
  questions_generated: number;
}): Promise<void> {
  console.log("[anamnesis] writing journal entry");
  const journalPrompt = buildJournalPrompt({
    memoriesExtracted: result.memories_extracted,
    memoriesAdded: result.memories_added,
    questionsGenerated: result.questions_generated,
    topMemories: [],
    topQuestions: [],
    predictions: [],
  });
  const journalResult = await llmCall({
    systemPrompt: journalPrompt.systemPrompt,
    message: journalPrompt.message,
  });
  await appendJournalEntry(journalResult.content);
  console.log("[anamnesis] journal entry written");
}

// ---------------------------------------------------------------------------
// Main reflection entry point
// ---------------------------------------------------------------------------

export async function runReflection(event: any): Promise<any> {
  await ensureStore();
  const { preparation } = event;

  const msgCount = preparation.messagesToSummarize.length;
  console.log(
    `[anamnesis] session_before_compact: ${msgCount} messages, ${preparation.tokensBefore} tokens`,
  );

  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize),
  );
  const userMsgCount = (conversationText.match(/^\[User\]:/gm) || []).length;
  console.log(
    `[anamnesis] session_before_compact: ${conversationText.length} chars, ${userMsgCount} user messages`,
  );

  // Check minimum message threshold
  if (userMsgCount < MIN_MESSAGES) {
    console.log(`[anamnesis] below threshold (${MIN_MESSAGES}), skipping reflection`);
    return {
      compaction: {
        summary: "Reflection skipped — too few messages.",
        firstKeptEntryId: preparation.firstKeptEntryId,
        tokensBefore: preparation.tokensBefore,
      },
    };
  }

  // Check foresight signals
  try {
    await checkForesight(conversationText);
  } catch (err) {
    console.log(`[anamnesis] foresight check failed: ${(err as Error).message}`);
  }

  // Run reflection pipeline
  console.log("[anamnesis] starting reflection pipeline");
  const reflectStart = Date.now();

  const existingMemories = await loadMemories();
  const result = await orchestrate(conversationText, existingMemories);
  const reflectMs = Date.now() - reflectStart;

  // Evolve memories (reinforce / supersede / add)
  const evolution = await evolveMemories(result.memories);

  // Store questions
  for (const q of result.questions) {
    await addQuestion(q);
  }

  // Store predictions
  if (result.predictions?.length) {
    await addPredictions(result.predictions);
  }

  // Save reflection log
  await saveReflection({
    timestamp: new Date().toISOString(),
    job: result.job,
    memories_added: evolution.added.length,
    memories_superseded: evolution.superseded.length,
    memories_reinforced: evolution.reinforced.length,
    questions_added: result.questions.length,
    predictions_added: result.predictions?.length || 0,
    metadata: result.metadata,
  });

  console.log(
    `[anamnesis] reflection complete in ${reflectMs}ms — ${result.memories.length} extracted, ${evolution.added.length} added, ${result.questions.length} questions`,
  );

  // Write journal (non-blocking — don't fail compaction if journal fails)
  try {
    await writeJournal({
      memories_extracted: result.memories.length,
      memories_added: evolution.added.length,
      questions_generated: result.questions.length,
    });
  } catch (err) {
    console.log(`[anamnesis] journal write failed: ${(err as Error).message}`);
  }

  const summary = `[Reflection ${result.job.job_id}] Extracted ${result.memories.length} memories (${evolution.added.length} new). Generated ${result.questions.length} questions. Use recalled memories and questions as background context for continued conversation.`;

  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    },
  };
}
