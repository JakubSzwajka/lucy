import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { RELEASE_LOG_PATH } from "./paths.js";

/**
 * Half-life in days per memory type.
 * "never" types use Infinity (no decay).
 */
const HALF_LIFE: Record<string, number> = {
  fact: 90,
  preference: 60,
  commitment: 30,
  moment: Infinity,    // moments never decay
  principle: Infinity, // principles never decay
  skill: 120,
  relationship: 90,
};

const RELEASE_THRESHOLD = 0.1;

interface Memory {
  id: string;
  type: string;
  content: string;
  created_at?: string;
  salience?: { importance?: number };
  confidence?: { score?: number };
  still_valid?: boolean;
  [key: string]: any;
}

interface ReleaseEntry {
  date: string;
  memoryId: string;
  content: string;
  type: string;
  reason: string;
  significanceAtRelease: number;
}

/**
 * Compute effective significance using FadeMem exponential decay.
 * Formula: significance * e^(-lambda * age_days)
 * where lambda = ln(2) / half_life_days
 */
export function computeEffectiveSignificance(memory: Memory, now: Date = new Date()): number {
  const halfLife = HALF_LIFE[memory.type] ?? 90;
  if (halfLife === Infinity) return 1.0; // never decay

  const baseSignificance = memory.salience?.importance ?? memory.confidence?.score ?? 0.5;

  if (!memory.created_at) return baseSignificance;

  const created = new Date(memory.created_at);
  const ageDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 0) return baseSignificance;

  const lambda = Math.LN2 / halfLife;
  return baseSignificance * Math.exp(-lambda * ageDays);
}

/**
 * Run forgetting pass on all memories.
 * Returns memories that should be kept and those that should be released.
 */
export function identifyReleaseCandidates(
  memories: Memory[],
  now: Date = new Date()
): { keep: Memory[]; release: (Memory & { effectiveSignificance: number })[] } {
  const keep: Memory[] = [];
  const release: (Memory & { effectiveSignificance: number })[] = [];

  for (const m of memories) {
    // Don't release already-invalidated memories (they're historical records)
    if (m.still_valid === false) {
      keep.push(m);
      continue;
    }

    const eff = computeEffectiveSignificance(m, now);

    if (eff < RELEASE_THRESHOLD) {
      release.push({ ...m, effectiveSignificance: eff });
    } else {
      keep.push(m);
    }
  }

  return { keep, release };
}

/**
 * Generate release reasons for logging.
 */
function generateReleaseReason(memory: Memory): string {
  const halfLife = HALF_LIFE[memory.type] ?? 90;
  if (memory.still_valid === false) return 'superseded by newer information';
  return `significance decayed below threshold (type ${memory.type}, half-life ${halfLife}d)`;
}

/**
 * Append release entries to the release log.
 */
export async function appendReleaseLog(entries: ReleaseEntry[]): Promise<void> {
  if (entries.length === 0) return;

  let existing = '';
  if (existsSync(RELEASE_LOG_PATH)) {
    existing = await readFile(RELEASE_LOG_PATH, 'utf-8');
  } else {
    existing = '# Release Log\n\n_Records of memories actively forgotten — the wisdom stays, the weight lifts._\n';
  }

  const today = new Date().toISOString().split('T')[0];
  const newEntries = [`\n## ${today}\n`];

  for (const entry of entries) {
    newEntries.push(`- **Released:** ${entry.memoryId} — "${entry.content.slice(0, 100)}"`);
    newEntries.push(`  - **Type:** ${entry.type}`);
    newEntries.push(`  - **Reason:** ${entry.reason}`);
    newEntries.push(`  - **Significance at release:** ${entry.significanceAtRelease.toFixed(3)}`);
    newEntries.push('');
  }

  await writeFile(RELEASE_LOG_PATH, existing + newEntries.join('\n'), 'utf-8');
}

/**
 * Run the full forgetting cycle.
 * Called at the end of each reflection.
 * Returns the number of memories released.
 */
export async function runForgettingCycle(
  memories: Memory[],
  saveMemories: (memories: Memory[]) => Promise<void>,
  now: Date = new Date()
): Promise<number> {
  const { keep, release } = identifyReleaseCandidates(memories, now);

  if (release.length === 0) return 0;

  // Build release log entries
  const entries: ReleaseEntry[] = release.map(m => ({
    date: now.toISOString().split('T')[0],
    memoryId: m.id,
    content: m.content,
    type: m.type,
    reason: generateReleaseReason(m),
    significanceAtRelease: m.effectiveSignificance,
  }));

  // Persist
  await saveMemories(keep);
  await appendReleaseLog(entries);

  console.log(`[anamnesis] forgetting: ${release.length} memories released`);

  return release.length;
}
