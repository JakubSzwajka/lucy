// ---------------------------------------------------------------------------
// Prompt Questions Extension
// ---------------------------------------------------------------------------
// Injects the questions context into the system prompt.
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const QUESTIONS_PATH = ".agents/memory/questions.md";

async function readSectionFile(
  path: string,
  prefix: string,
): Promise<string | null> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip any leftover HTML comment markers from the file
  const cleaned = trimmed
    .split("\n")
    .filter((line) => !/^<!--.*-->$/.test(line.trim()))
    .join("\n")
    .trim();

  if (!cleaned) return null;
  return `_${prefix}_\n\n${cleaned}`;
}


export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {

    // File: open questions
    const questions = await readSectionFile(
      QUESTIONS_PATH,
      "Questions generated from past reflections. Ask when the moment feels right — don't force them.",
    );

    return {
      systemPrompt: questions ?? "",
    };
  });
}
