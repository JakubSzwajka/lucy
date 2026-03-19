// ---------------------------------------------------------------------------
// Anamnesis — Memory Store
// ---------------------------------------------------------------------------
// Markdown file I/O for memories, questions, predictions, and reflection logs.
// Includes the A-MEM evolution pattern (reinforce / supersede / add).
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  MEMORY_PATH,
  QUESTIONS_PATH,
  PREDICTIONS_PATH,
  MEMORY_DIR,
} from "./paths.js";
import {
  generateId,
  MEMORY_TYPES,
  type Memory,
  type CuriosityQuestion,
  type Prediction,
  type EvolutionResult,
} from "./types.js";

const REFLECTIONS_DIR = join(MEMORY_DIR, "reflections");

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function initStore(): Promise<void> {
  for (const dir of [MEMORY_DIR, REFLECTIONS_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export async function loadMemories(): Promise<Memory[]> {
  if (!existsSync(MEMORY_PATH)) return [];
  const content = await readFile(MEMORY_PATH, "utf-8");
  return parseMemoriesMarkdown(content);
}

export async function saveMemories(memories: Memory[]): Promise<void> {
  await writeFile(MEMORY_PATH, formatMemoriesMarkdown(memories), "utf-8");
}

export async function evolveMemories(newMemories: Memory[]): Promise<EvolutionResult> {
  const existing = await loadMemories();
  const added: Memory[] = [];
  const superseded: EvolutionResult["superseded"] = [];
  const reinforced: EvolutionResult["reinforced"] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const memory of newMemories) {
    if (!memory.id) memory.id = generateId("mem");
    memory.created_at = memory.created_at || new Date().toISOString();

    let evolved = false;

    for (const ex of existing) {
      if (ex.type !== memory.type) continue;
      if (ex.still_valid === false) continue;

      // Reinforcement: same type, 70%+ word overlap → boost confidence
      if (isReinforcement(memory, ex)) {
        const score = typeof ex.confidence?.score === "number" ? ex.confidence.score : 0.5;
        ex.confidence = { ...ex.confidence, score: Math.min(1.0, score + 0.05) };
        ex.last_accessed = new Date().toISOString();
        reinforced.push({ existing_id: ex.id, new_content: memory.content });
        evolved = true;
        break;
      }

      // Contradiction: tag overlap or negation divergence → supersede
      if (isContradiction(memory, ex)) {
        ex.valid_until = today;
        ex.still_valid = false;
        memory.supersedes = ex.id;
        memory.valid_from = memory.valid_from || today;
        memory.still_valid = true;
        existing.push(memory);
        added.push(memory);
        superseded.push({ old_id: ex.id, new_id: memory.id });
        evolved = true;
        break;
      }
    }

    // New memory — no match
    if (!evolved) {
      const duplicate = existing.some(
        (m) => m.content.toLowerCase() === memory.content.toLowerCase(),
      );
      if (!duplicate) {
        memory.valid_from = memory.valid_from || today;
        memory.still_valid = true;
        existing.push(memory);
        added.push(memory);
      }
    }
  }

  if (added.length > 0 || superseded.length > 0 || reinforced.length > 0) {
    await saveMemories(existing);
  }

  console.log(
    `[anamnesis] evolution: ${added.length} added, ${superseded.length} superseded, ${reinforced.length} reinforced`,
  );

  return { added, superseded, reinforced };
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export async function loadQuestions(): Promise<CuriosityQuestion[]> {
  if (!existsSync(QUESTIONS_PATH)) return [];
  const content = await readFile(QUESTIONS_PATH, "utf-8");
  return parseQuestionsMarkdown(content);
}

export async function saveQuestions(questions: CuriosityQuestion[]): Promise<void> {
  await writeFile(QUESTIONS_PATH, formatQuestionsMarkdown(questions), "utf-8");
}

export async function addQuestion(question: CuriosityQuestion): Promise<void> {
  const questions = await loadQuestions();
  if (!question.id) question.id = generateId("q");

  const exists = questions.some(
    (q) => q.question.toLowerCase() === question.question.toLowerCase(),
  );
  if (exists) return;

  questions.push({
    ...question,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  await saveQuestions(questions);
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export async function loadPredictions(): Promise<Prediction[]> {
  if (!existsSync(PREDICTIONS_PATH)) return [];
  const content = await readFile(PREDICTIONS_PATH, "utf-8");
  return parsePredictionsMarkdown(content);
}

export async function savePredictions(predictions: Prediction[]): Promise<void> {
  await writeFile(PREDICTIONS_PATH, formatPredictionsMarkdown(predictions), "utf-8");
}

export async function addPredictions(newPredictions: Prediction[]): Promise<void> {
  const existing = await loadPredictions();
  for (const pred of newPredictions) {
    if (!pred.id) pred.id = generateId("pred");
    pred.planted = pred.planted || new Date().toISOString().split("T")[0];
    pred.status = pred.status || "pending";
    existing.push(pred);
  }
  await savePredictions(existing);
}

// ---------------------------------------------------------------------------
// Reflection logs
// ---------------------------------------------------------------------------

export async function saveReflection(reflection: Record<string, unknown>): Promise<string> {
  if (!existsSync(REFLECTIONS_DIR)) await mkdir(REFLECTIONS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(REFLECTIONS_DIR, `${timestamp}.json`);
  await writeFile(path, JSON.stringify(reflection, null, 2), "utf-8");
  return path;
}

// ---------------------------------------------------------------------------
// Evolution helpers
// ---------------------------------------------------------------------------

function isReinforcement(newMem: Memory, existingMem: Memory): boolean {
  if (newMem.type !== existingMem.type) return false;
  return wordOverlap(newMem.content, existingMem.content) > 0.7;
}

function isContradiction(newMem: Memory, existingMem: Memory): boolean {
  if (newMem.type !== existingMem.type) return false;
  if (existingMem.still_valid === false) return false;
  if (newMem.content.toLowerCase() === existingMem.content.toLowerCase()) return false;

  // Tag overlap (2+ shared tags)
  const tagOverlap = (newMem.tags || []).filter((t) => (existingMem.tags || []).includes(t));
  if (tagOverlap.length >= 2) return true;

  // Word overlap + negation divergence
  const overlap = wordOverlap(newMem.content, existingMem.content);
  if (overlap > 0.3 && hasNegationDivergence(newMem.content, existingMem.content)) return true;

  return false;
}

function wordOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;
  const intersection = [...words1].filter((w) => words2.has(w));
  return intersection.length / Math.min(words1.size, words2.size);
}

function hasNegationDivergence(text1: string, text2: string): boolean {
  const negations = [
    "not", "don't", "doesn't", "isn't", "won't", "never",
    "no longer", "stopped", "changed from",
  ];
  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();
  return negations.some(
    (neg) => (t1.includes(neg) && !t2.includes(neg)) || (!t1.includes(neg) && t2.includes(neg)),
  );
}

// ---------------------------------------------------------------------------
// Markdown serialization — Memories
// ---------------------------------------------------------------------------

function parseMemoriesMarkdown(content: string): Memory[] {
  const memories: Memory[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const type = lines[0].trim().toLowerCase() as Memory["type"];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("- ")) continue;

      const memory: Memory = { id: generateId("mem"), type, content: line.slice(2).trim() };

      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("<!--")) {
        try {
          const metaLine = lines[i + 1].trim();
          Object.assign(memory, JSON.parse(metaLine.slice(4, -3)));
          i++;
        } catch {}
      }

      memories.push(memory);
    }
  }

  return memories;
}

function formatMemoriesMarkdown(memories: Memory[]): string {
  const lines = ["# Memory", "", `_Last updated: ${new Date().toISOString()}_`, ""];

  const byType: Record<string, Memory[]> = {};
  for (const m of memories) {
    (byType[m.type] ??= []).push(m);
  }

  for (const type of MEMORY_TYPES) {
    if (!byType[type]?.length) continue;
    lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}`, "");

    for (const m of byType[type]) {
      lines.push(`- ${m.content}`);
      const meta: Record<string, unknown> = {
        id: m.id, confidence: m.confidence, tags: m.tags,
        source_quote: m.source_quote, source_turn: m.source_turn,
        created_at: m.created_at, valid_from: m.valid_from,
        valid_until: m.valid_until, still_valid: m.still_valid,
        supersedes: m.supersedes, salience: m.salience,
        confabulation_risk: m.confabulation_risk, confabulation_reason: m.confabulation_reason,
      };
      lines.push(`  <!-- ${JSON.stringify(meta)} -->`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Markdown serialization — Questions
// ---------------------------------------------------------------------------

function parseQuestionsMarkdown(content: string): CuriosityQuestion[] {
  const questions: CuriosityQuestion[] = [];
  const lines = content.split("\n");
  let current: CuriosityQuestion | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      if (current) questions.push(current);
      current = {
        id: generateId("q"),
        question: trimmed.slice(6).trim(),
        status: trimmed.startsWith("- [ ]") ? "pending" : "answered",
      };
    } else if (current && trimmed.startsWith("_") && trimmed.endsWith("_")) {
      current.context = trimmed.slice(1, -1);
    } else if (current && trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
      try { Object.assign(current, JSON.parse(trimmed.slice(4, -3))); } catch {}
    }
  }
  if (current) questions.push(current);
  return questions;
}

function formatQuestionsMarkdown(questions: CuriosityQuestion[]): string {
  const lines = ["# Pending Questions", "", `_Generated from reflection. Last updated: ${new Date().toISOString()}_`, ""];

  const pending = questions.filter((q) => q.status === "pending");
  const resolved = questions.filter((q) => q.status !== "pending");

  for (const q of pending) {
    lines.push(`- [ ] ${q.question}`);
    if (q.context) lines.push(`  _${q.context}_`);
    lines.push(`  <!-- ${JSON.stringify({
      id: q.id, curiosity_type: q.curiosity_type, curiosity_score: q.curiosity_score,
      timing: q.timing, sensitivity: q.sensitivity, source_memory_ids: q.source_memory_ids,
    })} -->`, "");
  }

  if (resolved.length > 0) {
    lines.push("## Resolved", "");
    for (const q of resolved.slice(0, 10)) {
      lines.push(`- [x] ${q.question}`);
      if (q.answer_summary) lines.push(`  _Answer: ${q.answer_summary}_`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Markdown serialization — Predictions
// ---------------------------------------------------------------------------

function parsePredictionsMarkdown(content: string): Prediction[] {
  const predictions: Prediction[] = [];
  const lines = content.split("\n");
  let current: Prediction | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      if (current) predictions.push(current);
      current = {
        id: generateId("pred"),
        content: trimmed.slice(6).replace(/\s*\[.*\]\s*$/, "").trim(),
        planted: "",
        status: trimmed.startsWith("- [ ]") ? "pending" : "resolved",
      };
    } else if (current && trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
      try { Object.assign(current, JSON.parse(trimmed.slice(4, -3))); } catch {}
    }
  }
  if (current) predictions.push(current);
  return predictions;
}

function formatPredictionsMarkdown(predictions: Prediction[]): string {
  const lines = ["# Predictions", "", `_Last updated: ${new Date().toISOString()}_`, ""];
  const pending = predictions.filter((p) => p.status === "pending");
  const resolved = predictions.filter((p) => p.status !== "pending");

  if (pending.length > 0) {
    lines.push("## Pending", "");
    for (const p of pending) {
      lines.push(`- [ ] ${p.content}`);
      lines.push(`  <!-- ${JSON.stringify({
        id: p.id, planted: p.planted, confidence: p.confidence,
        status: p.status, source_memory_ids: p.source_memory_ids,
      })} -->`, "");
    }
  }

  if (resolved.length > 0) {
    lines.push("## Resolved", "");
    for (const p of resolved.slice(0, 20)) {
      lines.push(`- [x] ${p.content} [${p.status}]`);
      lines.push(`  <!-- ${JSON.stringify({
        id: p.id, planted: p.planted, resolved: p.resolved_at, status: p.status,
      })} -->`, "");
    }
  }

  return lines.join("\n");
}
