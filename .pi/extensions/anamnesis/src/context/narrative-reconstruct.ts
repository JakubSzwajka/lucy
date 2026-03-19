/**
 * Narrative Reconstruction — "Store structured, reconstruct narrative"
 *
 * Takes scored memories and renders them as first-person narrative
 * for system prompt injection. Template-based, no LLM calls.
 */

interface ScoredMemory {
  id: string;
  type: string;
  content: string;
  tags?: string[];
  retrieval_score: number;
  confidence?: { score?: number };
  salience?: { importance?: number; novelty?: number };
  valid_from?: string;
  supersedes?: string;
  [key: string]: any;
}

/**
 * Reconstruct narrative from scored memories.
 * Groups by type, renders as natural first-person prose.
 * Target output: 200-400 tokens.
 *
 * @param memories - Top-K memories (already scored and sorted)
 * @returns First-person narrative paragraph
 */
export function reconstructNarrative(memories: ScoredMemory[]): string {
  if (memories.length === 0) return '';

  const grouped = groupByType(memories);
  const parts: string[] = [];

  // Facts first
  if (grouped.fact?.length) {
    const facts = grouped.fact.map(m => m.content).slice(0, 5);
    parts.push(`I remember that ${facts.join('. I also know that ')}.`);
  }

  // Preferences
  if (grouped.preference?.length) {
    const prefs = grouped.preference.map(m => m.content).slice(0, 3);
    parts.push(`Regarding preferences: ${prefs.join('. ')}.`);
  }

  // Relationships
  if (grouped.relationship?.length) {
    const rels = grouped.relationship.map(m => m.content).slice(0, 3);
    parts.push(`In our relationship: ${rels.join('. ')}.`);
  }

  // Principles
  if (grouped.principle?.length) {
    const principles = grouped.principle.map(m => m.content).slice(0, 2);
    parts.push(`I hold that ${principles.join('. And that ')}.`);
  }

  // Commitments
  if (grouped.commitment?.length) {
    const commitments = grouped.commitment.map(m => m.content).slice(0, 2);
    parts.push(`Outstanding commitments: ${commitments.join('. ')}.`);
  }

  // Moments
  if (grouped.moment?.length) {
    const moments = grouped.moment.map(m => m.content).slice(0, 2);
    parts.push(`Notable moments: ${moments.join('. ')}.`);
  }

  // Skills
  if (grouped.skill?.length) {
    const skills = grouped.skill.map(m => m.content).slice(0, 2);
    parts.push(`I've learned: ${skills.join('. ')}.`);
  }

  return parts.join('\n\n');
}

function groupByType(memories: ScoredMemory[]): Record<string, ScoredMemory[]> {
  const groups: Record<string, ScoredMemory[]> = {};
  for (const m of memories) {
    if (!groups[m.type]) groups[m.type] = [];
    groups[m.type].push(m);
  }
  return groups;
}
