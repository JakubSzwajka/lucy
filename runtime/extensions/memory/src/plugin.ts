import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createAnthropic } from "@ai-sdk/anthropic";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { resolveDataDir } from "agents-runtime";

import { observe } from "./observe.js";
import { synthesizeMemory } from "./synthesize.js";
import { MEMORY_MD_PATH } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_FACTS = 50;

async function readMemoryFromDisk(dataDir: string): Promise<string | null> {
  try {
    const content = await readFile(join(dataDir, MEMORY_MD_PATH), "utf-8");
    const trimmed = content.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export default function memoryExtension(pi: ExtensionAPI) {
  const dataDir = resolveDataDir();
  const modelId = process.env.MEMORY_OBSERVER_MODEL ?? DEFAULT_MODEL;
  const maxFacts =
    parseInt(process.env.MEMORY_MAX_FACTS ?? "", 10) || DEFAULT_MAX_FACTS;

  pi.on("before_agent_start", async (event) => {
    const memory = await readMemoryFromDisk(dataDir);
    if (!memory) return;
    console.log(`[memory] injecting memory (${memory.length} chars)`);
    return {
      systemPrompt: event.systemPrompt + "\n\n## Memory\n" + memory,
    };
  });

  pi.on("agent_end", async (event) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("[memory] no ANTHROPIC_API_KEY, skipping observation");
      return;
    }

    const messages = event.messages;
    if (!messages || messages.length === 0) return;

    console.log(
      `[memory] run complete, triggering observer (${messages.length} messages)`,
    );
    try {
      const anthropic = createAnthropic({ apiKey });
      const model = anthropic(modelId);
      await observe(dataDir, messages, model);
      await synthesizeMemory(dataDir, model, maxFacts);
    } catch (err) {
      console.error(
        `[memory] observer pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
