// ---------------------------------------------------------------------------
// Prompt sync — wires up all sections and exposes a single sync call
// ---------------------------------------------------------------------------

import { PromptComposer } from "./prompt-composer.js";
import { buildContextContent, type PromptContext } from "./prompt-context.js";

const MEMORY_PATH = ".agents/memory/MEMORY.md";
const QUESTIONS_PATH = ".agents/memory/questions.md";

/**
 * Create the composer with all registered sections.
 * Context is dynamic (rebuilt per-request), memory and questions are file-based.
 */
function createComposer(ctx: PromptContext): PromptComposer {
  const composer = new PromptComposer();

  // Dynamic: request context (time, source)
  composer.addDynamicSection(
    "CONTEXT",
    async () => buildContextContent(ctx),
    { heading: "## Context" },
  );

  // File: long-term memory from continuity skill (file has its own heading)
  composer.addFileSection("MEMORY", MEMORY_PATH, {
    prefix: "Recalled memories from previous sessions. Use them as background knowledge.",
  });

  // File: open questions from continuity skill (file has its own heading)
  composer.addFileSection("QUESTIONS", QUESTIONS_PATH, {
    prefix: "Questions generated from past reflections. Ask when the moment feels right — don't force them.",
  });

  return composer;
}

/**
 * Sync all dynamic sections into the system prompt file.
 * Call this once before each message to the agent.
 */
export async function syncPrompt(ctx: PromptContext): Promise<void> {
  const composer = createComposer(ctx);
  await composer.sync();
}
