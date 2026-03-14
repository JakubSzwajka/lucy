// ---------------------------------------------------------------------------
// Prompt Context Extension
// ---------------------------------------------------------------------------
// Injects the environment context into the system prompt.
// Time
// ---------------------------------------------------------------------------

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";


function buildContext(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = new Date().toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `## Context\n\n- Time: ${formatted} (${tz})`;
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const context = buildContext();
    return {
      systemPrompt: event.systemPrompt + "\n\n" + context,
    };
  });
}
