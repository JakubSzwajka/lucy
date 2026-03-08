import type { Item } from "agents-runtime";

export function formatTranscript(items: Item[]): string {
  const callIdToToolName = new Map<string, string>();

  for (const item of items) {
    if (item.type === "tool_call") {
      callIdToToolName.set(item.callId, item.toolName);
    }
  }

  const lines: string[] = [];

  for (const item of items) {
    switch (item.type) {
      case "message":
        if (item.content) {
          lines.push(`[${item.role}] ${item.content}`);
        }
        break;

      case "tool_call":
        lines.push(`[tool_call] ${item.toolName}`);
        break;

      case "tool_result": {
        const toolName = callIdToToolName.get(item.callId) ?? item.callId;

        if (item.toolError) {
          lines.push(`[tool_error] ${toolName}: ${item.toolError}`);
        } else if (item.toolOutput) {
          const output =
            item.toolOutput.length > 200
              ? item.toolOutput.slice(0, 200) + "…"
              : item.toolOutput;
          lines.push(`[tool_result] ${toolName}: ${output}`);
        }
        break;
      }

      case "reasoning":
        break;
    }
  }

  return lines.join("\n");
}
