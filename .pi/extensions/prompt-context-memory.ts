// ---------------------------------------------------------------------------
// Prompt Memory Extension
// ---------------------------------------------------------------------------
// Injects the memory context into the system prompt.
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const MEMORY_PATH = ".agents/memory/MEMORY.md";

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
    // File: long-term memory
    const memory = await readSectionFile(
      MEMORY_PATH,
      "Recalled memories from previous sessions. Use them as background knowledge.",
    );

    return {
      systemPrompt: memory ?? "",
    };
  });
}
