// ---------------------------------------------------------------------------
// Dynamic prompt context — builds the CONTEXT section for PromptComposer
// ---------------------------------------------------------------------------

export type RequestSource = "browser" | "telegram" | "api" | "unknown";

export interface PromptContext {
  source?: RequestSource;
  timezone?: string;
}

/**
 * Build context lines for injection into the system prompt.
 * Returns the inner content (no markers — the composer handles those).
 */
export function buildContextContent(ctx: PromptContext): string {
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
  parts.push(`- Time: ${formatted} (${tz})`);

  if (ctx.source && ctx.source !== "unknown") {
    parts.push(`- Source: ${ctx.source}`);
  }

  return parts.join("\n");
}
