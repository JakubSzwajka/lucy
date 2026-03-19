// ---------------------------------------------------------------------------
// Anamnesis — Phase 3: Integrate
// ---------------------------------------------------------------------------
// Merges reflection results into persistent state: evolve memories,
// persist questions and predictions, save reflection log, write journal.
// ---------------------------------------------------------------------------

import { buildJournalPrompt, appendJournalEntry } from "./context/journal.js";
import { llmCall } from "./llm.js";
import {
  evolveMemories,
  addQuestion,
  addPredictions,
  saveReflection,
} from "./store.js";
import type { ReflectionResult, EvolutionResult } from "./types.js";

export interface IntegrationResult {
  evolution: EvolutionResult;
  questionsStored: number;
  predictionsStored: number;
}

export async function integrate(result: ReflectionResult, conversationText: string): Promise<IntegrationResult> {
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
    `[anamnesis] integrate: ${evolution.added.length} added, ${evolution.superseded.length} superseded, ${evolution.reinforced.length} reinforced, ${result.questions.length} questions, ${result.predictions?.length || 0} predictions`,
  );

  // Write journal (non-blocking — don't fail the pipeline)
  try {
    await writeJournal({
      conversationText,
      memories_extracted: result.memories.length,
      memories_added: evolution.added.length,
      questions_generated: result.questions.length,
    });
  } catch (err) {
    console.log(`[anamnesis] journal write failed: ${(err as Error).message}`);
  }

  return {
    evolution,
    questionsStored: result.questions.length,
    predictionsStored: result.predictions?.length || 0,
  };
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

async function writeJournal(stats: {
  conversationText: string;
  memories_extracted: number;
  memories_added: number;
  questions_generated: number;
}): Promise<void> {
  console.log("[anamnesis] writing journal entry");
  const journalPrompt = buildJournalPrompt({
    conversationText: stats.conversationText,
    memoriesExtracted: stats.memories_extracted,
    memoriesAdded: stats.memories_added,
    questionsGenerated: stats.questions_generated,
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
