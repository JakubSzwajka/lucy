import { getItemService } from "@/lib/server/sessions";
import type { CreateItemData } from "@/lib/server/sessions";
import type { ToolCallStatus } from "@/types";

async function insertItem(agentId: string, itemData: CreateItemData): Promise<void> {
  const itemService = getItemService();
  const result = await itemService.create(agentId, itemData);
  if (result.error || !result.item) {
    throw new Error(result.error || "Failed to insert item");
  }
}

async function saveToolCall(agentId: string, callId: string, toolName: string, toolArgs: Record<string, unknown>, status: ToolCallStatus = "running"): Promise<void> {
  const itemService = getItemService();
  const result = await itemService.createToolCall(agentId, callId, toolName, toolArgs, status);
  if (result.error || !result.item) {
    throw new Error(result.error || "Failed to save tool call");
  }
}

async function saveToolResult(agentId: string, callId: string, result?: unknown, error?: string): Promise<void> {
  const itemService = getItemService();
  const itemResult = await itemService.createToolResult(agentId, callId, result, error);
  if (itemResult.error || !itemResult.item) {
    throw new Error(itemResult.error || "Failed to save tool result");
  }
}

async function updateToolCallStatus(callId: string, status: ToolCallStatus): Promise<void> {
  const itemService = getItemService();
  await itemService.updateToolCallStatus(callId, status);
}

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
  input: Record<string, unknown>;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
}

interface ToolErrorPart {
  type: "tool-error";
  toolCallId: string;
  toolName: string;
  error: unknown;
}

type ContentPart = TextPart | ReasoningPart | ToolCallPart | ToolResultPart | ToolErrorPart;


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
 * @param content - Array of content parts from the step (text, tool-call, tool-result, reasoning)
 */
export async function persistStepContent(
  agentId: string,
  content: ContentPart[]
): Promise<void> {
  // Process content parts in their natural order (reasoning is included in content array)
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
        // Save tool call (AI SDK uses `input`, not `args`)
        await saveToolCall(
          agentId,
          part.toolCallId,
          part.toolName,
          part.input,
          "running"
        );
        break;

      case "tool-result":
        // Save tool result and update status (AI SDK uses `output`, not `result`)
        await saveToolResult(agentId, part.toolCallId, part.output);
        await updateToolCallStatus(part.toolCallId, "completed");
        break;

      case "tool-error":
        // Save tool error and update status
        await saveToolResult(
          agentId,
          part.toolCallId,
          undefined,
          String(part.error)
        );
        await updateToolCallStatus(part.toolCallId, "failed");
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
