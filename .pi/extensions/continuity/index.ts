// ---------------------------------------------------------------------------
// Continuity Extension
// ---------------------------------------------------------------------------
// Self-contained Pi extension for memory reflection and continuity.
// Handles: compaction-triggered reflection, memory/questions prompt injection.
// ---------------------------------------------------------------------------

import { ExtensionAPI, serializeConversation, convertToLlm } from "@mariozechner/pi-coding-agent";
import { ContinuitySkill } from "./src/index.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const MEMORY_PATH = ".agents/memory/MEMORY.md";
const QUESTIONS_PATH = ".agents/memory/questions.md";

const skill = new ContinuitySkill();

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

export default function (pi: ExtensionAPI) {
  // --- Prompt injection: memory context ---
  pi.on("before_agent_start", async (_event) => {
    const memory = await readSectionFile(
      MEMORY_PATH,
      "Recalled memories from previous sessions. Use them as background knowledge.",
    );
    const questions = await readSectionFile(
      QUESTIONS_PATH,
      "Questions generated from past reflections. Ask when the moment feels right — don't force them.",
    );

    const parts = [memory, questions].filter(Boolean);
    if (parts.length === 0) return {};

    // Append to existing system prompt rather than replacing it
    return {
      systemPrompt: _event.systemPrompt + "\n\n" + parts.join("\n\n"),
    };
  });

  // --- Compaction hook: trigger reflection ---
  pi.on("session_before_compact", async (event, _ctx) => {
    const { preparation } = event;

    console.log("[continuity] session_before_compact — reflecting on memories");

    const conversationText = serializeConversation(
      convertToLlm(preparation.messagesToSummarize),
    );

    await skill.reflect({
      session: "custom",
      summary: conversationText,
    });

    return {
      compaction: {
        summary:
          "Custom Summary to be implemented. As soon as you will hit one, notify Kuba. Since this point, you should start thinking based on your memories and available messages.",
        firstKeptEntryId: preparation.firstKeptEntryId,
        tokensBefore: preparation.tokensBefore,
      },
    };
  });
}
