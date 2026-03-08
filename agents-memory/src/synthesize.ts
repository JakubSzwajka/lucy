import { generateText, type LanguageModel } from "ai";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readObservations } from "./store.js";
import type { Observation } from "./types.js";
import { MEMORY_MD_PATH } from "./types.js";

const DEFAULT_MAX_FACTS = 50;

export const SYNTHESIS_PROMPT = `You are a memory synthesizer. You receive a list of raw observations about a human and produce a concise memory document.

Your output is markdown that will be injected into an AI agent's system prompt as context about the person it's talking to. Write it like notes a perceptive colleague would keep — direct, useful, no filler.

## Rules

- Group related facts into short paragraphs. Use blank lines to separate groups.
- Lead with the most important and actionable information. Put trivia and minor details last.
- Use present tense, declarative statements: "Works at Acme Corp" not "The user works at Acme Corp."
- Never reference the observations themselves. No "Based on observations..." or "According to the data..." — just state the facts.
- Do not include confidence scores, categories, observation types, or any input metadata in the output.
- Do not pad or bulk up the output. If there are 5 observations, write 5 lines, not 20. Every line must earn its place.
- Do not use headers, bullet points, or structured formatting unless grouping genuinely benefits from it. Prefer flowing prose-style notes.
- Do not repeat yourself. If two observations say the same thing, merge them into one statement.
- When observations conflict, prefer the one that appears more specific or recent. Do not flag the conflict.
- Output raw markdown only. No code fences, no preamble, no sign-off.`;

/**
 * Keep the most relevant observations within the limit.
 * Sorts by confidence (descending), then by recency (descending).
 */
function pruneObservations(
  observations: Observation[],
  limit: number,
): Observation[] {
  if (observations.length <= limit) return observations;

  return [...observations]
    .sort((a, b) => b.confidence - a.confidence || b.ts - a.ts)
    .slice(0, limit);
}

/**
 * Synthesize memory.md from all allow-gated observations.
 */
export async function synthesizeMemory(
  dataDir: string,
  model: LanguageModel,
  maxFacts?: number,
): Promise<void> {
  const observations = await readObservations(dataDir);
  const allowed = observations.filter((o) => o.gate === "allow");

  if (allowed.length === 0) return;

  const limit = maxFacts ?? DEFAULT_MAX_FACTS;
  const pruned = pruneObservations(allowed, limit);

  const observationsText = pruned
    .map(
      (o) =>
        `- [${o.type}] ${o.content} (confidence: ${o.confidence}, category: ${o.category})`,
    )
    .join("\n");

  const { text } = await generateText({
    model,
    prompt: observationsText,
    system: SYNTHESIS_PROMPT,
  });

  const filePath = join(dataDir, MEMORY_MD_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, text.trim() + "\n", "utf-8");
}
