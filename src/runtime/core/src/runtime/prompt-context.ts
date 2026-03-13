// ---------------------------------------------------------------------------
// Dynamic prompt context — appended to each user message
// ---------------------------------------------------------------------------

export type RequestSource = "browser" | "telegram" | "api" | "unknown";

export interface PromptContext {
  source?: RequestSource;
  timezone?: string;
}

/**
 * Build a context block to prepend to the user message.
 * Keeps it short — the model doesn't need a novel.
 */
export function buildContextBlock(ctx: PromptContext): string {
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

  return `<context>\n${parts.join("\n")}\n</context>`;
}

/**
 * Prepend context block to a user message.
 */
export function withContext(message: string, ctx: PromptContext): string {
  const block = buildContextBlock(ctx);
  return `${block}\n\n${message}`;
}
