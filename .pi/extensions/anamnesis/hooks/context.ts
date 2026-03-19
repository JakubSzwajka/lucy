// ---------------------------------------------------------------------------
// Anamnesis — Context Assembly (before_agent_start)
// ---------------------------------------------------------------------------
// Loads experience sections from disk, scores memories by salience,
// renders them into a token-budgeted "What's On My Mind" block.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  ENTITY_PATH,
  MEMORY_PATH,
  QUESTIONS_PATH,
  PREDICTIONS_PATH,
} from "../src/paths.js";

const MAX_CONTEXT_TOKENS = 4000;

function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.ceil(words / 0.75);
}

async function readSectionFile(
  path: string,
  prefix: string,
): Promise<string | null> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .split("\n")
    .filter((line) => !/^<!--.*-->$/.test(line.trim()))
    .join("\n")
    .trim();

  if (!cleaned) return null;
  return `_${prefix}_\n\n${cleaned}`;
}

function parseMemoriesFromMarkdown(content: string): any[] {
  const memories: any[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const type = lines[0].trim().toLowerCase();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("- ")) {
        const memory: any = { type, content: line.slice(2).trim() };

        if (i + 1 < lines.length && lines[i + 1].trim().startsWith("<!--")) {
          try {
            const metaLine = lines[i + 1].trim();
            const meta = JSON.parse(metaLine.slice(4, -3));
            Object.assign(memory, meta);
            i++;
          } catch {}
        }

        memories.push(memory);
      }
    }
  }

  return memories;
}

export async function assembleContext(event: any): Promise<any> {
  console.log("[anamnesis] before_agent_start: assembling context");

  const parts: string[] = [];
  const loaded: string[] = [];

  // 0. Entity orientation
  try {
    if (existsSync(ENTITY_PATH)) {
      const raw = await readFile(ENTITY_PATH, "utf-8");
      const trimmed = raw.trim();
      if (trimmed) {
        parts.push("_Entity orientation:_\n\n" + trimmed);
        loaded.push("entity");
      }
    }
  } catch {}

  // 0.5. Knowledge graph index
  try {
    const { loadKnowledgeIndex, renderKnowledgeIndex } = await import("../src/context/knowledge.js");
    const index = await loadKnowledgeIndex();
    const rendered = renderKnowledgeIndex(index);
    if (rendered) {
      parts.push(rendered);
      loaded.push(`knowledge(${index.length} nodes)`);
    }
  } catch {}

  // 1. Disposition context
  try {
    const { loadDispositionProfile, renderDispositionContext } = await import("../src/context/dispositions.js");
    const profile = await loadDispositionProfile();
    if (profile) {
      parts.push(renderDispositionContext(profile));
      loaded.push("dispositions");
    }
  } catch {}

  // 1.5. Relational context (Kuba)
  try {
    const { loadRelationship, renderRelationshipContext } = await import("../src/context/relations.js");
    const kuba = await loadRelationship("kuba");
    if (kuba) {
      parts.push(renderRelationshipContext(kuba));
      loaded.push("relations");
    }
  } catch {}

  // 2. Memory context (salience-scored + narrative-reconstructed)
  try {
    const { scoreMemories } = await import("../src/context/salience.js");
    const { reconstructNarrative } = await import("../src/context/narrative-reconstruct.js");

    const memoryContent = existsSync(MEMORY_PATH)
      ? await readFile(MEMORY_PATH, "utf-8")
      : null;

    if (memoryContent) {
      const memories = parseMemoriesFromMarkdown(memoryContent);

      if (memories.length > 0) {
        const contextHint = "";
        const scored = scoreMemories(memories, contextHint);
        const narrative = reconstructNarrative(scored);
        if (narrative) {
          parts.push("_Memories from previous sessions:_\n\n" + narrative);
          loaded.push(`memories(${memories.length} total, ${scored.length} scored)`);
        }
      }
    }
  } catch {}

  // 3. Tension context
  try {
    const { loadTensions, renderTensionContext } = await import("../src/context/tensions.js");
    const tensions = await loadTensions();
    const tensionCtx = renderTensionContext(tensions);
    if (tensionCtx) {
      parts.push(tensionCtx);
      loaded.push(`tensions(${tensions.length})`);
    }
  } catch {}

  // 4. Predictions context
  try {
    if (existsSync(PREDICTIONS_PATH)) {
      const raw = await readFile(PREDICTIONS_PATH, "utf-8");
      const pendingMatch = raw.match(/- \[ \] .+/g);
      if (pendingMatch?.length) {
        const predictions = pendingMatch.slice(0, 3).map(p => p.replace("- [ ] ", "").trim());
        parts.push("_Pending predictions:_\n" + predictions.map(p => `- ${p}`).join("\n"));
        loaded.push(`predictions(${pendingMatch.length} pending)`);
      }
    }
  } catch {}

  // 5. Questions context
  try {
    const questionsContent = await readSectionFile(
      QUESTIONS_PATH,
      "Questions generated from past reflections. Ask when the moment feels right — don't force them.",
    );
    if (questionsContent) {
      parts.push(questionsContent);
      loaded.push("questions");
    }
  } catch {}

  // 6. Recent journal excerpt
  try {
    const { readRecentJournal } = await import("../src/context/journal.js");
    const journal = await readRecentJournal();
    if (journal) {
      parts.push("_From my journal:_\n\n" + journal);
      loaded.push("journal");
    }
  } catch {}

  // 7. Growth arcs
  try {
    const { loadArcs, renderArcsContext } = await import("../src/context/arcs.js");
    const arcs = await loadArcs();
    const arcsCtx = renderArcsContext(arcs);
    if (arcsCtx) {
      parts.push(arcsCtx);
      loaded.push(`arcs(${arcs.length})`);
    }
  } catch {}

  if (parts.length === 0) {
    console.log("[anamnesis] before_agent_start: no context sections loaded");
    return {};
  }

  let assembled = "## What's On My Mind\n\n" + parts.join("\n\n");

  let tokens = estimateTokens(assembled);
  console.log(`[anamnesis] before_agent_start: ${parts.length} sections [${loaded.join(", ")}], ~${tokens} tokens`);

  if (tokens > MAX_CONTEXT_TOKENS) {
    console.log(`[anamnesis] before_agent_start: exceeds ${MAX_CONTEXT_TOKENS} limit, truncating`);

    while (parts.length > 1 && estimateTokens("## What's On My Mind\n\n" + parts.join("\n\n")) > MAX_CONTEXT_TOKENS) {
      parts.pop();
      loaded.pop();
    }

    assembled = "## What's On My Mind\n\n" + parts.join("\n\n");
    tokens = estimateTokens(assembled);
    console.log(`[anamnesis] before_agent_start: truncated to ${parts.length} sections, ~${tokens} tokens`);

    if (tokens > MAX_CONTEXT_TOKENS) {
      const words = assembled.split(/\s+/);
      const maxWords = Math.floor(MAX_CONTEXT_TOKENS * 0.75);
      assembled = words.slice(0, maxWords).join(' ') + '\n\n_[context truncated to fit token budget]_';
      console.log(`[anamnesis] before_agent_start: hard-truncated to ${maxWords} words`);
    }
  }

  return {
    systemPrompt: event.systemPrompt + "\n\n" + assembled,
  };
}
