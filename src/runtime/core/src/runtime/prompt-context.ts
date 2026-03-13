// ---------------------------------------------------------------------------
// Dynamic prompt context — injected into the system prompt file
// ---------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RequestSource = "browser" | "telegram" | "api" | "unknown";

export interface PromptContext {
  source?: RequestSource;
  timezone?: string;
}

const CONTEXT_START = "<!-- CONTEXT:START -->";
const CONTEXT_END = "<!-- CONTEXT:END -->";

function getPromptPath(): string {
  return resolve(process.env.PI_BRIDGE_PROMPT ?? "prompt.md");
}

/**
 * Build the context section content.
 */
function buildContextSection(ctx: PromptContext): string {
  const parts: string[] = [];

  const now = new Date();
  const tz = ctx.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = now.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  parts.push(`Time: ${formatted} (${tz})`);

  if (ctx.source && ctx.source !== "unknown") {
    parts.push(`Source: ${ctx.source}`);
  }

  return [
    CONTEXT_START,
    "",
    "## Context",
    "",
    ...parts.map((p) => `- ${p}`),
    "",
    CONTEXT_END,
  ].join("\n");
}

/**
 * Sync the context block into the system prompt file.
 * Replaces the managed section between CONTEXT markers, or appends it.
 * Pi auto-reloads the prompt on file change.
 */
export async function syncPromptContext(ctx: PromptContext): Promise<void> {
  const promptPath = getPromptPath();
  let content: string;

  try {
    content = await readFile(promptPath, "utf-8");
  } catch {
    // No prompt file — nothing to inject into
    return;
  }

  const section = buildContextSection(ctx);
  const startIdx = content.indexOf(CONTEXT_START);
  const endIdx = content.indexOf(CONTEXT_END);

  let updated: string;
  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    updated = content.slice(0, startIdx) + section + content.slice(endIdx + CONTEXT_END.length);
  } else {
    // Append at the end
    updated = content.trimEnd() + "\n\n" + section + "\n";
  }

  if (updated !== content) {
    await writeFile(promptPath, updated, "utf-8");
  }
}
