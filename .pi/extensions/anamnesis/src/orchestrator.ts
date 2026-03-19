// ---------------------------------------------------------------------------
// Anamnesis — Reflection Orchestrator
// ---------------------------------------------------------------------------
// Coordinates the 3-phase reflection pipeline:
//   1. Classification — extract memories from conversation
//   2. Scoring — assign confidence levels
//   3. Generation — produce curiosity questions + predictions
// Includes confabulation checking between phases 1 and 2.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { llmCall } from "./llm.js";
import {
  generateId,
  type Memory,
  type CuriosityQuestion,
  type Prediction,
  type ReflectionJob,
  type ReflectionResult,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "prompts");

// ---------------------------------------------------------------------------
// Prompt loading
// ---------------------------------------------------------------------------

interface AgentPrompts {
  classifier: { soul: string; prompt: string };
  scorer: { soul: string; prompt: string };
  generator: { soul: string; prompt: string };
}

let prompts: AgentPrompts | null = null;

async function loadPrompt(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    console.warn(`[anamnesis] failed to load prompt: ${path}`);
    return "";
  }
}

async function ensurePrompts(): Promise<AgentPrompts> {
  if (prompts) return prompts;
  prompts = {
    classifier: {
      soul: await loadPrompt(join(PROMPTS_DIR, "classifier", "SOUL.md")),
      prompt: await loadPrompt(join(PROMPTS_DIR, "classifier", "prompts", "classify.md")),
    },
    scorer: {
      soul: await loadPrompt(join(PROMPTS_DIR, "scorer", "SOUL.md")),
      prompt: await loadPrompt(join(PROMPTS_DIR, "scorer", "prompts", "score.md")),
    },
    generator: {
      soul: await loadPrompt(join(PROMPTS_DIR, "generator", "SOUL.md")),
      prompt: await loadPrompt(join(PROMPTS_DIR, "generator", "prompts", "generate.md")),
    },
  };
  return prompts;
}

// ---------------------------------------------------------------------------
// LLM call helper
// ---------------------------------------------------------------------------

async function callAgent(systemPrompt: string, message: string): Promise<unknown> {
  const result = await llmCall({ systemPrompt, message });
  return parseJson(result.content);
}

function parseJson(response: string): unknown {
  // Try to extract JSON from markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Try to find a raw JSON object or array in the response
  const jsonStart = response.search(/[\[{]/);
  if (jsonStart >= 0) {
    const candidate = response.slice(jsonStart);
    try {
      return JSON.parse(candidate);
    } catch {
      // Try trimming trailing non-JSON content
      const lastBrace = candidate.lastIndexOf("}");
      const lastBracket = candidate.lastIndexOf("]");
      const end = Math.max(lastBrace, lastBracket);
      if (end > 0) {
        return JSON.parse(candidate.slice(0, end + 1));
      }
    }
  }

  throw new Error(`[orchestrator] no valid JSON found in response (${response.length} chars)`);
}

// ---------------------------------------------------------------------------
// Template substitution
// ---------------------------------------------------------------------------

function buildClassifierPrompt(template: string, conversation: string, existingMemories: Memory[]): string {
  let prompt = template;
  prompt = prompt.replace("{{conversation}}", conversation);
  prompt = prompt.replace("{{#if existing_memories}}", existingMemories.length ? "" : "<!--");
  prompt = prompt.replace("{{/if}}", existingMemories.length ? "" : "-->");
  prompt = prompt.replace("{{existing_memories}}", JSON.stringify(existingMemories, null, 2));
  return prompt;
}

function buildScorerPrompt(template: string, memories: Memory[], conversation: string): string {
  let prompt = template;
  prompt = prompt.replace("{{memories}}", JSON.stringify(memories, null, 2));
  prompt = prompt.replace("{{#if conversation_context}}", conversation ? "" : "<!--");
  prompt = prompt.replace("{{/if}}", conversation ? "" : "-->");
  prompt = prompt.replace("{{conversation_context}}", conversation || "");
  return prompt;
}

function buildGeneratorPrompt(template: string, scoredMemories: Memory[], existingMemories: Memory[]): string {
  let prompt = template;
  prompt = prompt.replace("{{memories}}", JSON.stringify(scoredMemories, null, 2));
  prompt = prompt.replace("{{#if existing_context}}", existingMemories.length ? "" : "<!--");
  prompt = prompt.replace("{{/if}}", existingMemories.length ? "" : "-->");
  prompt = prompt.replace("{{existing_context}}", JSON.stringify(existingMemories, null, 2));
  return prompt;
}

// ---------------------------------------------------------------------------
// Confabulation check
// ---------------------------------------------------------------------------

function checkConfabulation(memories: Memory[], conversation: string): Memory[] {
  const conversationLower = conversation.toLowerCase();

  return memories.map((memory) => {
    if (!memory.source_quote) {
      return {
        ...memory,
        confabulation_risk: true,
        confabulation_reason: "no_source_quote",
        confidence: memory.confidence
          ? { ...memory.confidence, score: (memory.confidence.score || 0.7) * 0.5 }
          : undefined,
      };
    }

    const snippet50 = memory.source_quote.toLowerCase().slice(0, 50);
    if (conversationLower.includes(snippet50)) {
      return { ...memory, confabulation_risk: false };
    }

    const snippet30 = memory.source_quote.toLowerCase().slice(0, 30);
    if (conversationLower.includes(snippet30)) {
      return { ...memory, confabulation_risk: false };
    }

    return {
      ...memory,
      confabulation_risk: true,
      confabulation_reason: "source_quote_not_found",
      confidence: memory.confidence
        ? { ...memory.confidence, score: (memory.confidence.score || 0.7) * 0.5 }
        : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Local fallbacks (when LLM is unavailable)
// ---------------------------------------------------------------------------

function localClassify(conversation: string): { memories: Memory[]; extraction_metadata: Record<string, unknown> } {
  const memories: Memory[] = [];
  const lines = conversation.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[User]:")) continue;

    const content = trimmed.replace(/^\[User\]:/, "").trim();
    if (content.length < 10) continue;

    let type: Memory["type"] = "fact";
    if (/\b(like|love|prefer|hate|enjoy)\b/i.test(content)) type = "preference";
    else if (/\b(will|promise|commit|agree)\b/i.test(content)) type = "commitment";
    else if (/\b(always|never|must|should)\b/i.test(content)) type = "principle";

    memories.push({
      id: generateId("mem"),
      type,
      content: content.slice(0, 200),
      tags: [],
      source_quote: content.slice(0, 100),
    });
  }

  return { memories, extraction_metadata: { messages_analyzed: lines.length, memories_extracted: memories.length } };
}

function localScore(memories: Memory[]): { scored_memories: Memory[]; scoring_metadata: Record<string, unknown> } {
  const scored = memories.map((m) => ({
    ...m,
    confidence: { score: 0.7, level: "implied" as const, source: "context_implied" as const, evidence: ["Local classification"], decay_rate: 0.0 },
  }));
  const total = scored.reduce((sum, m) => sum + (m.confidence?.score || 0), 0);
  return {
    scored_memories: scored,
    scoring_metadata: {
      memories_scored: scored.length,
      average_confidence: scored.length > 0 ? total / scored.length : 0,
      confidence_distribution: { explicit: 0, implied: scored.length, inferred: 0, speculative: 0 },
    },
  };
}

function localGenerate(memories: Memory[]): { questions: CuriosityQuestion[]; predictions: Prediction[]; generation_metadata: Record<string, unknown> } {
  const questions: CuriosityQuestion[] = [];
  const types = new Set(memories.map((m) => m.type));

  if (types.has("commitment")) {
    questions.push({
      id: generateId("q"),
      question: "How is that project you mentioned progressing?",
      context: "Following up on commitments",
      source_memory_ids: memories.filter((m) => m.type === "commitment").map((m) => m.id),
      curiosity_type: "implication",
      curiosity_score: 0.8,
      timing: "next_session",
      sensitivity: "low",
      status: "pending",
    });
  }

  return {
    questions,
    predictions: [],
    generation_metadata: { memories_analyzed: memories.length, questions_generated: questions.length },
  };
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

export async function runReflection(
  conversation: string,
  existingMemories: Memory[],
  sessionId?: string,
): Promise<ReflectionResult> {
  const p = await ensurePrompts();
  const jobId = generateId("job");
  const startTime = Date.now();
  const hasLlm = !!process.env.OPENROUTER_API_KEY;

  const job: ReflectionJob = {
    job_id: jobId,
    status: "queued",
    session_id: sessionId || generateId("session"),
    created_at: new Date().toISOString(),
    phases: {},
    output: {},
  };

  const convLines = conversation.split("\n").length;
  console.log(`[anamnesis] orchestrator: job ${jobId}, ${convLines} lines, ${existingMemories.length} existing memories`);

  try {
    // Phase 1: Classification
    job.status = "classifying";
    job.phases.classification = { started_at: new Date().toISOString() };
    console.log(`[anamnesis] orchestrator: phase 1/3 classify`);

    let classified: { memories: Memory[]; extraction_metadata: Record<string, unknown> };
    if (hasLlm && p.classifier.soul) {
      const prompt = buildClassifierPrompt(p.classifier.prompt, conversation, existingMemories);
      classified = (await callAgent(p.classifier.soul, prompt)) as typeof classified;
    } else {
      classified = localClassify(conversation);
    }

    job.phases.classification.completed_at = new Date().toISOString();
    job.phases.classification.items_processed = classified.memories.length;
    console.log(`[anamnesis] orchestrator: classify done — ${classified.memories.length} memories`);

    // Phase 1.5: Confabulation check
    const checked = checkConfabulation(classified.memories, conversation);
    const flagged = checked.filter((m) => m.confabulation_risk).length;
    console.log(`[anamnesis] orchestrator: confabulation — ${checked.length - flagged} grounded, ${flagged} flagged`);

    // Phase 2: Scoring
    job.status = "scoring";
    job.phases.scoring = { started_at: new Date().toISOString() };
    console.log(`[anamnesis] orchestrator: phase 2/3 score`);

    let scored: { scored_memories: Memory[]; scoring_metadata: Record<string, unknown> };
    if (hasLlm && p.scorer.soul) {
      const prompt = buildScorerPrompt(p.scorer.prompt, checked, conversation);
      scored = (await callAgent(p.scorer.soul, prompt)) as typeof scored;
    } else {
      scored = localScore(checked);
    }

    job.phases.scoring.completed_at = new Date().toISOString();
    job.phases.scoring.items_processed = scored.scored_memories.length;
    const avgConf = (scored.scoring_metadata.average_confidence as number) || 0;
    console.log(`[anamnesis] orchestrator: score done — avg confidence ${avgConf.toFixed(2)}`);

    // Phase 3: Generation
    job.status = "generating";
    job.phases.generation = { started_at: new Date().toISOString() };
    console.log(`[anamnesis] orchestrator: phase 3/3 generate`);

    let generated: { questions: CuriosityQuestion[]; predictions?: Prediction[]; generation_metadata: Record<string, unknown> };
    if (hasLlm && p.generator.soul) {
      const prompt = buildGeneratorPrompt(p.generator.prompt, scored.scored_memories, existingMemories);
      generated = (await callAgent(p.generator.soul, prompt)) as typeof generated;
    } else {
      generated = localGenerate(scored.scored_memories);
    }

    job.phases.generation.completed_at = new Date().toISOString();
    job.phases.generation.items_processed = generated.questions.length;
    console.log(`[anamnesis] orchestrator: generate done — ${generated.questions.length} questions`);

    // Complete
    job.status = "complete";
    job.completed_at = new Date().toISOString();
    const totalMs = Date.now() - startTime;
    console.log(`[anamnesis] orchestrator: job ${jobId} complete in ${totalMs}ms`);

    return {
      job,
      memories: scored.scored_memories,
      questions: generated.questions,
      predictions: generated.predictions || [],
      metadata: {
        extraction: classified.extraction_metadata,
        scoring: scored.scoring_metadata,
        generation: generated.generation_metadata,
        total_time_ms: totalMs,
      },
    };
  } catch (error) {
    console.log(`[anamnesis] orchestrator: job ${jobId} failed in '${job.status}': ${(error as Error).message}`);
    job.status = "failed";
    job.error = { phase: job.status, message: (error as Error).message };
    job.completed_at = new Date().toISOString();
    throw error;
  }
}
