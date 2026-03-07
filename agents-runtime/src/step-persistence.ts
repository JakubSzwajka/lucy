import type { ItemStore } from "./ports.js";

// Content part types from AI SDK step output
interface TextPart { type: "text"; text: string; }
interface ReasoningPart { type: "reasoning"; text: string; }
interface ToolCallPart { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown>; }
interface ToolResultPart { type: "tool-result"; toolCallId: string; toolName: string; output: unknown; }
interface ToolErrorPart { type: "tool-error"; toolCallId: string; toolName: string; error: unknown; }
export type ContentPart = TextPart | ReasoningPart | ToolCallPart | ToolResultPart | ToolErrorPart;

export async function persistStepContent(
  items: ItemStore,
  agentId: string,
  content: ContentPart[],
): Promise<void> {
  let textAccumulator = "";

  for (const part of content) {
    switch (part.type) {
      case "text":
        textAccumulator += part.text;
        break;

      case "reasoning":
        if (textAccumulator) {
          await items.createMessage(agentId, { role: "assistant", content: textAccumulator });
          textAccumulator = "";
        }
        await items.create({
          id: crypto.randomUUID(),
          agentId,
          sequence: 0,
          type: "reasoning",
          reasoningContent: part.text,
          reasoningSummary:
            part.text.slice(0, 200) + (part.text.length > 200 ? "..." : ""),
          createdAt: new Date(),
        });
        break;

      case "tool-call":
        if (textAccumulator) {
          await items.createMessage(agentId, { role: "assistant", content: textAccumulator });
          textAccumulator = "";
        }
        await items.createToolCall(agentId, {
          callId: part.toolCallId,
          toolName: part.toolName,
          toolArgs: part.input,
          toolStatus: "running",
        });
        break;

      case "tool-result":
        await items.createToolResult(agentId, {
          callId: part.toolCallId,
          toolOutput:
            typeof part.output === "string"
              ? part.output
              : JSON.stringify(part.output),
        });
        await items.updateToolCallStatus(part.toolCallId, "completed");
        break;

      case "tool-error":
        await items.createToolResult(agentId, {
          callId: part.toolCallId,
          toolError: String(part.error),
        });
        await items.updateToolCallStatus(part.toolCallId, "failed");
        break;
    }
  }

  if (textAccumulator) {
    await items.createMessage(agentId, { role: "assistant", content: textAccumulator });
  }
}
