import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Salience scoring weights (configurable)
 */
const DEFAULT_WEIGHTS = {
  recency: 0.25,
  importance: 0.25,
  relevance: 0.25,
  novelty: 0.15,
  tension: 0.10,
};

interface Memory {
  id: string;
  type: string;
  content: string;
  tags?: string[];
  created_at?: string;
  still_valid?: boolean;
  salience?: {
    importance?: number;
    novelty?: number;
    affect_heuristic?: { valence?: number; arousal?: number };
  };
  confidence?: { score?: number };
  [key: string]: any;
}

interface ScoredMemory extends Memory {
  retrieval_score: number;
}

/**
 * Score memories by salience for context assembly.
 * Pure local computation — no LLM calls.
 *
 * @param memories - All memories from the store
 * @param context - First user message or session topic for relevance matching
 * @param activeTensionIds - Memory IDs linked to active tensions (get +0.2 boost)
 * @param topK - Number of top memories to return (default 10)
 * @param weights - Scoring weights (optional override)
 */
export function scoreMemories(
  memories: Memory[],
  context: string,
  activeTensionIds: string[] = [],
  topK: number = 10,
  weights = DEFAULT_WEIGHTS,
): ScoredMemory[] {
  const now = Date.now();
  const contextWords = extractKeywords(context);
  const tensionSet = new Set(activeTensionIds);

  const scored = memories
    .filter(m => m.still_valid !== false) // exclude superseded memories
    .map(m => {
      const recency = computeRecency(m.created_at, now);
      const importance = m.salience?.importance ?? 0.5;
      const relevance = computeRelevance(m, contextWords);
      const novelty = m.salience?.novelty ?? 0.3;
      const tensionBoost = tensionSet.has(m.id) ? 1.0 : 0.0;

      const score =
        weights.recency * recency +
        weights.importance * importance +
        weights.relevance * relevance +
        weights.novelty * novelty +
        weights.tension * tensionBoost;

      return { ...m, retrieval_score: score };
    });

  // Sort descending by score, take top K
  scored.sort((a, b) => b.retrieval_score - a.retrieval_score);
  return scored.slice(0, topK);
}

/**
 * Exponential decay from creation time.
 * Half-life: 7 days by default.
 */
function computeRecency(createdAt: string | undefined, now: number, halfLifeDays = 7): number {
  if (!createdAt) return 0.5; // no timestamp = moderate recency
  const created = new Date(createdAt).getTime();
  const ageDays = (now - created) / (1000 * 60 * 60 * 24);
  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}

/**
 * Keyword-based relevance scoring.
 * Simple word intersection between memory content/tags and context.
 */
function computeRelevance(memory: Memory, contextWords: Set<string>): number {
  if (contextWords.size === 0) return 0.5; // no context = moderate relevance

  // Build memory word set from content + tags
  const memoryWords = extractKeywords(memory.content);
  if (memory.tags) {
    for (const tag of memory.tags) {
      memoryWords.add(tag.toLowerCase());
    }
  }

  if (memoryWords.size === 0) return 0;

  let matches = 0;
  for (const word of contextWords) {
    if (memoryWords.has(word)) matches++;
  }

  // Normalize by context size (what fraction of context words appear in memory)
  return Math.min(matches / contextWords.size, 1.0);
}

/**
 * Extract meaningful keywords from text.
 * Filters out short words and common stop words.
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "for", "and", "but", "or",
    "not", "with", "this", "that", "from", "they", "them", "their",
    "what", "which", "who", "whom", "how", "when", "where", "why",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "than", "too", "very", "just", "about", "into",
  ]);

  return new Set(
    text.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9-]/g, ""))
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

export { DEFAULT_WEIGHTS };
