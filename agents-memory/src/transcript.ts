import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { TextContent, ToolCall } from "@mariozechner/pi-ai";

export function formatTranscript(messages: AgentMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "user": {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .filter((c): c is TextContent => c.type === "text")
                .map((c) => c.text)
                .join("");
        if (content) lines.push(`[user] ${content}`);
        break;
      }
      case "assistant": {
        const textParts = msg.content
          .filter((c): c is TextContent => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (textParts) lines.push(`[assistant] ${textParts}`);

        for (const part of msg.content) {
          if (part.type === "toolCall") {
            const toolCall = part as ToolCall;
            lines.push(`[tool_call] ${toolCall.name}`);
          }
        }
        break;
      }
      case "toolResult": {
        const toolName = msg.toolName;
        const content = msg.content
          .filter((c): c is TextContent => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (msg.isError) {
          lines.push(`[tool_error] ${toolName}: ${content}`);
        } else if (content) {
          const output =
            content.length > 200 ? content.slice(0, 200) + "…" : content;
          lines.push(`[tool_result] ${toolName}: ${output}`);
        }
        break;
      }
      case "bashExecution": {
        const bash = msg as { role: "bashExecution"; command: string; output: string };
        lines.push(`[bash] ${bash.command}`);
        if (bash.output) {
          const output =
            bash.output.length > 200
              ? bash.output.slice(0, 200) + "…"
              : bash.output;
          lines.push(`[bash_output] ${output}`);
        }
        break;
      }
      // Skip custom, compactionSummary, branchSummary
    }
  }

  return lines.join("\n");
}
