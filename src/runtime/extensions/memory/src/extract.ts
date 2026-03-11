import type { Observation, ObservationGate, ObservationType } from "./types.js";

const VALID_TYPES: Set<string> = new Set<ObservationType>([
  "fact",
  "preference",
  "principle",
  "relationship",
  "skill",
]);

const VALID_GATES: Set<string> = new Set<ObservationGate>([
  "allow",
  "discard",
  "hold",
]);

/** System prompt for LLM-based memory extraction from conversation transcripts. */
export const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation transcript and extract observations about the **human** participant.

## Observation Types

- **fact** — Concrete, verifiable information: name, location, job title, technical stack, age, timezone.
- **preference** — Stated or demonstrated preferences: likes dark mode, prefers TypeScript over JavaScript, dislikes lengthy meetings.
- **principle** — Values, beliefs, or decision-making heuristics: favors simplicity over cleverness, values privacy, "measure twice cut once."
- **skill** — Demonstrated capabilities or expertise: knows Rust, experienced with Kubernetes, strong at system design.
- **relationship** — People, organizations, or systems the human relates to: works at Acme Corp, collaborates with Alice, maintains an open-source project.

## Gating

Each observation gets a gate that controls whether it enters long-term memory:

- **allow** — Clearly stated or strongly demonstrated. High confidence (>=0.7). Stored and surfaced.
- **hold** — Implied or inferred, not yet confirmed. Stored but not surfaced until corroborated.
- **discard** — Too vague, too transient, or conversational noise. Not stored.

## Confidence (0.0–1.0)

- 0.9–1.0: Explicitly stated ("I work at Google", "I prefer Vim").
- 0.7–0.8: Strongly implied by behavior or context.
- 0.5–0.6: Inferred from indirect evidence.
- Below 0.5: Speculative — gate as \`hold\` or \`discard\`.

## Do NOT extract

- Transient task context ("fix this bug", "add a button here").
- Information about the AI assistant itself.
- Obvious or universal facts ("JavaScript runs in browsers").
- Duplicate observations — deduplicate within your response.

## Category

Assign a short grouping label: e.g. "work", "tech-stack", "personal", "communication-style", "health", "hobby".

## Output

Return a JSON array (no wrapping text). Each element:

\`\`\`json
{ "type": "<type>", "content": "<observation>", "confidence": <number>, "gate": "<gate>", "category": "<label>" }
\`\`\`

If there is nothing worth extracting, return an empty array \`[]\`.`;

type RawEntry = Record<string, unknown>;

/**
 * Parse and validate LLM extraction response.
 * Drops malformed entries rather than throwing.
 */
export function parseExtractionResponse(
  raw: string,
  agentId: string,
): Omit<Observation, "id" | "ts">[] {
  const jsonText = extractJsonArray(raw);
  if (jsonText === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const results: Omit<Observation, "id" | "ts">[] = [];

  for (const entry of parsed as RawEntry[]) {
    const validated = validateEntry(entry, agentId);
    if (validated !== null) {
      results.push(validated);
    }
  }

  return results;
}

/**
 * Extract the first JSON array substring from raw LLM output.
 * Handles optional markdown code-block wrapping.
 */
function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const body = fenceMatch ? fenceMatch[1].trim() : trimmed;

  // Find the outermost [ ... ] bracket pair
  const start = body.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "[") depth++;
    else if (body[i] === "]") depth--;
    if (depth === 0) return body.slice(start, i + 1);
  }

  return null;
}

function validateEntry(
  entry: RawEntry,
  agentId: string,
): Omit<Observation, "id" | "ts"> | null {
  if (entry === null || typeof entry !== "object") return null;

  const { category, confidence, content, gate, type } = entry;

  if (typeof type !== "string" || !VALID_TYPES.has(type)) return null;
  if (typeof content !== "string" || content.trim().length === 0) return null;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) return null;
  if (typeof gate !== "string" || !VALID_GATES.has(gate)) return null;
  if (typeof category !== "string" || category.trim().length === 0) return null;

  return {
    agentId,
    category: category.trim(),
    confidence,
    content: content.trim(),
    gate: gate as ObservationGate,
    supersededBy: null,
    type: type as ObservationType,
  };
}
