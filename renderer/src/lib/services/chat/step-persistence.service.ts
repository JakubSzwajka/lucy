import {
  insertItem,
  saveToolCall,
  saveToolResult,
  updateToolCallStatus,
} from "@/lib/tools";

// ============================================================================
// Types for AI SDK Step Content
// ============================================================================

interface TextPart {
  type: "text";
  text: string;
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
}

interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

type ContentPart = TextPart | ReasoningPart | ToolCallPart | ToolResultPart;

interface ReasoningBlock {
  text?: string;
}

// ============================================================================
// Step Persistence Service
// ============================================================================

/**
 * Persist step content from AI SDK's onStepFinish callback.
 *
 * This function processes content parts in their natural interleaved order,
 * ensuring that items are saved to the database in the same sequence they
 * were streamed from the AI model.
 *
 * @param agentId - The agent ID to associate items with
 * @param content - Array of content parts from the step (text, tool-call, tool-result)
 * @param reasoning - Optional reasoning blocks from the step
 */
export async function persistStepContent(
  agentId: string,
  content: ContentPart[],
  reasoning?: ReasoningBlock[]
): Promise<void> {
  // 1. If reasoning exists, save it first (reasoning typically comes before content)
  if (reasoning?.length) {
    const reasoningText = reasoning
      .filter((r) => r.text)
      .map((r) => r.text)
      .join("\n");

    if (reasoningText) {
      await insertItem(agentId, {
        type: "reasoning",
        reasoningContent: reasoningText,
        reasoningSummary:
          reasoningText.slice(0, 200) + (reasoningText.length > 200 ? "..." : ""),
      });
    }
  }

  // 2. Process content parts in their natural order
  let textAccumulator = "";

  for (const part of content) {
    switch (part.type) {
      case "text":
        // Accumulate text - we'll flush it when we hit a tool call or at the end
        textAccumulator += part.text;
        break;

      case "reasoning":
        // Reasoning can also appear in content array
        // Flush any accumulated text first
        if (textAccumulator) {
          await insertItem(agentId, {
            type: "message",
            role: "assistant",
            content: textAccumulator,
          });
          textAccumulator = "";
        }
        // Save reasoning
        await insertItem(agentId, {
          type: "reasoning",
          reasoningContent: part.text,
          reasoningSummary:
            part.text.slice(0, 200) + (part.text.length > 200 ? "..." : ""),
        });
        break;

      case "tool-call":
        // Flush accumulated text before tool call to maintain order
        if (textAccumulator) {
          await insertItem(agentId, {
            type: "message",
            role: "assistant",
            content: textAccumulator,
          });
          textAccumulator = "";
        }
        // Save tool call
        await saveToolCall(
          agentId,
          part.toolCallId,
          part.toolName,
          part.args,
          "running"
        );
        break;

      case "tool-result":
        // Save tool result and update status
        if (part.isError) {
          await saveToolResult(
            agentId,
            part.toolCallId,
            undefined,
            String(part.result)
          );
          await updateToolCallStatus(part.toolCallId, "failed");
        } else {
          await saveToolResult(agentId, part.toolCallId, part.result);
          await updateToolCallStatus(part.toolCallId, "completed");
        }
        break;
    }
  }

  // 3. Flush any remaining accumulated text
  if (textAccumulator) {
    await insertItem(agentId, {
      type: "message",
      role: "assistant",
      content: textAccumulator,
    });
  }
}
