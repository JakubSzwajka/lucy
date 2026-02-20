import type {
  Item,
  ChatMessage,
  ContentPart,
  TextContentPart,
  ReasoningContentPart,
  ToolCallContentPart,
} from "@/types";

// ============================================================================
// Item Transformer
// ============================================================================

/**
 * Pure functions for transforming items to/from different formats.
 * Used by both API routes and client-side hooks.
 */
export class ItemTransformer {
  /**
   * Convert items to interleaved ContentParts for a single assistant turn
   */
  static itemsToContentParts(
    items: Item[],
    toolResultsByCallId: Map<string, Item>
  ): ContentPart[] {
    const parts: ContentPart[] = [];

    for (const item of items) {
      switch (item.type) {
        case "reasoning":
          parts.push({
            type: "reasoning",
            id: item.id,
            content: item.reasoningContent,
            summary: item.reasoningSummary || undefined,
          } as ReasoningContentPart);
          break;

        case "tool_call": {
          const resultItem = toolResultsByCallId.get(item.callId);
          parts.push({
            type: "tool_call",
            id: item.id,
            callId: item.callId,
            toolName: item.toolName,
            args: item.toolArgs || undefined,
            status: item.toolStatus,
            result: resultItem?.type === "tool_result" ? (resultItem.toolOutput || undefined) : undefined,
            error: resultItem?.type === "tool_result" ? (resultItem.toolError || undefined) : undefined,
          } as ToolCallContentPart);
          break;
        }

        case "message":
          if (item.role === "assistant" && item.content) {
            parts.push({
              type: "text",
              id: item.id,
              text: item.content,
            } as TextContentPart);
          }
          break;

        // Skip tool_result - it's merged into tool_call above
        case "tool_result":
          break;
      }
    }

    return parts;
  }

  /**
   * Convert items to ChatMessages for display with interleaved parts
   */
  static itemsToChatMessages(loadedItems: Item[]): ChatMessage[] {
    const messages: ChatMessage[] = [];
    let currentParts: ContentPart[] = [];

    // Build tool_results map upfront for merging with tool_calls
    const toolResultsByCallId = new Map<string, Item>();
    for (const item of loadedItems) {
      if (item.type === "tool_result") {
        toolResultsByCallId.set(item.callId, item);
      }
    }

    for (const item of loadedItems) {
      if (item.type === "message" && item.role === "user") {
        // User message - finalize any pending assistant content first
        if (currentParts.length > 0) {
          // Create assistant message with accumulated parts
          messages.push({
            id: `assistant-${messages.length}`,
            role: "assistant",
            content: currentParts
              .filter((p): p is TextContentPart => p.type === "text")
              .map((p) => p.text)
              .join(""),
            parts: [...currentParts],
          });
          currentParts = [];
        }

        // Add user message
        messages.push({
          id: item.id,
          role: item.role,
          content: item.content,
          createdAt: item.createdAt,
        });
      } else if (item.type === "message" && item.role === "assistant") {
        // Assistant text - add as a text part in order
        currentParts.push({
          type: "text",
          id: item.id,
          text: item.content,
        } as TextContentPart);
      } else if (item.type === "reasoning") {
        // Reasoning - add as part
        currentParts.push({
          type: "reasoning",
          id: item.id,
          content: item.reasoningContent,
          summary: item.reasoningSummary || undefined,
        } as ReasoningContentPart);
      } else if (item.type === "tool_call") {
        // Tool call - add as part
        const resultItem = toolResultsByCallId.get(item.callId);
        const toolPart: ToolCallContentPart = {
          type: "tool_call",
          id: item.id,
          callId: item.callId,
          toolName: item.toolName,
          args: item.toolArgs || undefined,
          status: item.toolStatus,
          result: resultItem?.type === "tool_result" ? (resultItem.toolOutput || undefined) : undefined,
          error: resultItem?.type === "tool_result" ? (resultItem.toolError || undefined) : undefined,
        };
        currentParts.push(toolPart);
      }
      // Skip tool_result - it's merged into tool_call
    }

    // Finalize any remaining assistant content
    if (currentParts.length > 0) {
      messages.push({
        id: `assistant-${messages.length}`,
        role: "assistant",
        content: currentParts
          .filter((p): p is TextContentPart => p.type === "text")
          .map((p) => p.text)
          .join(""),
        parts: [...currentParts],
      });
    }

    return messages;
  }
}

// Export standalone functions for convenience
export const itemsToContentParts = ItemTransformer.itemsToContentParts;
export const itemsToChatMessages = ItemTransformer.itemsToChatMessages;
