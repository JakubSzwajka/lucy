import type {
  Item,
  ChatMessage,
  ContentPart,
  TextContentPart,
  ReasoningContentPart,
  ToolCallContentPart,
} from "@/types";
import {
  type UIMessage,
  isTextUIPart,
  isReasoningUIPart,
  isToolUIPart,
  getToolName,
} from "ai";

// ============================================================================
// Item Transformer
// ============================================================================

/**
 * Pure functions for transforming items to/from different formats.
 * Used by both API routes and client-side hooks.
 */
export class ItemTransformer {
  /**
   * Extract text content from UIMessage parts (AI SDK format)
   */
  static extractContent(message: UIMessage): string {
    return message.parts
      .filter(isTextUIPart)
      .map((part) => part.text)
      .join("");
  }

  /**
   * Extract interleaved content parts from AI SDK UIMessage parts (streaming format).
   * Handles text, reasoning, and tool parts (both static tool-* and dynamic-tool).
   */
  static extractContentPartsFromStreamingMessage(message: UIMessage): ContentPart[] {
    const contentParts: ContentPart[] = [];

    for (let index = 0; index < message.parts.length; index++) {
      const part = message.parts[index];

      if (isReasoningUIPart(part)) {
        contentParts.push({
          type: "reasoning",
          id: `${message.id}-reasoning-${index}`,
          content: part.text,
        } satisfies ReasoningContentPart);
      } else if (isTextUIPart(part)) {
        contentParts.push({
          type: "text",
          id: `${message.id}-text-${index}`,
          text: part.text,
        } satisfies TextContentPart);
      } else if (isToolUIPart(part)) {
        let status: "running" | "completed" | "failed" = "running";
        if (part.state === "output-available") {
          status = "completed";
        } else if (part.state === "output-error") {
          status = "failed";
        }

        contentParts.push({
          type: "tool_call",
          id: `${message.id}-tool-${index}`,
          callId: part.toolCallId,
          toolName: getToolName(part),
          args: part.input as Record<string, unknown> | undefined,
          status,
          result: part.state === "output-available" && part.output
            ? JSON.stringify(part.output)
            : undefined,
          error: part.state === "output-error" ? part.errorText : undefined,
        } satisfies ToolCallContentPart);
      }
    }

    return contentParts;
  }

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

  /**
   * Merge loaded items with streaming messages from AI SDK
   */
  static mergeWithStreaming(
    loadedItems: Item[],
    rawMessages: UIMessage[]
  ): ChatMessage[] {
    // Start with loaded items converted to messages
    const fromItems = ItemTransformer.itemsToChatMessages(loadedItems);

    // Find new messages from streaming that aren't in loaded items
    const loadedMessageIds = new Set(
      loadedItems.filter((i) => i.type === "message").map((i) => i.id)
    );

    const streamingMessages = rawMessages
      .filter((msg) => !loadedMessageIds.has(msg.id))
      .map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: ItemTransformer.extractContent(msg),
        parts: ItemTransformer.extractContentPartsFromStreamingMessage(msg),
      }));

    return [...fromItems, ...streamingMessages];
  }
}

// Export standalone functions for convenience
export const extractContent = ItemTransformer.extractContent;
export const extractContentPartsFromStreamingMessage = ItemTransformer.extractContentPartsFromStreamingMessage;
export const itemsToContentParts = ItemTransformer.itemsToContentParts;
export const itemsToChatMessages = ItemTransformer.itemsToChatMessages;
export const mergeWithStreaming = ItemTransformer.mergeWithStreaming;
