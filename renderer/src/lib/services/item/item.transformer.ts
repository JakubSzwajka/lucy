import type {
  Item,
  ChatMessage,
  AgentActivity,
  ReasoningActivity,
  ToolCallActivity,
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
   * Extract text content from UIMessage parts (AI SDK format)
   */
  static extractContent(message: Record<string, unknown>): string {
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.parts)) {
      return (message.parts as Record<string, unknown>[])
        .filter((part) => part.type === "text")
        .map((part) => part.text as string)
        .join("");
    }
    return "";
  }

  /**
   * Extract interleaved content parts from AI SDK UIMessage parts (streaming format).
   * AI SDK uses part.type = "tool-${toolName}" format (e.g., "tool-getWeather")
   * States: "input-streaming", "input-available", "output-available", "output-error"
   */
  static extractContentPartsFromStreamingMessage(message: Record<string, unknown>): ContentPart[] {
    const contentParts: ContentPart[] = [];

    if (!Array.isArray(message.parts)) {
      return contentParts;
    }

    const parts = message.parts as Record<string, unknown>[];

    // Process parts in order to maintain interleaving
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const partType = part.type as string;

      if (partType === "reasoning") {
        contentParts.push({
          type: "reasoning",
          id: `${message.id}-reasoning-${index}`,
          content: part.text as string,
        } as ReasoningContentPart);
      } else if (partType === "text") {
        contentParts.push({
          type: "text",
          id: `${message.id}-text-${index}`,
          text: part.text as string,
        } as TextContentPart);
      } else if (partType.startsWith("tool-")) {
        // Extract tool name from "tool-${toolName}" format
        const toolName = partType.slice(5); // Remove "tool-" prefix
        const state = part.state as string;

        // Determine status based on AI SDK state values
        let status: "running" | "completed" | "failed" = "running";
        if (state === "output-available") {
          status = "completed";
        } else if (state === "output-error") {
          status = "failed";
        }

        contentParts.push({
          type: "tool_call",
          id: `${message.id}-tool-${index}`,
          callId: part.toolCallId as string,
          toolName: toolName,
          args: part.input as Record<string, unknown>,
          status,
          result: state === "output-available" && part.output
            ? JSON.stringify(part.output)
            : undefined,
          error: state === "output-error" && part.errorText
            ? (part.errorText as string)
            : undefined,
        } as ToolCallContentPart);
      }
    }

    return contentParts;
  }

  /**
   * Extract activities from AI SDK UIMessage parts (streaming format).
   * AI SDK uses part.type = "tool-${toolName}" format (e.g., "tool-getWeather")
   * States: "input-streaming", "input-available", "output-available", "output-error"
   */
  static extractActivitiesFromParts(message: Record<string, unknown>): AgentActivity[] {
    const activities: AgentActivity[] = [];

    if (!Array.isArray(message.parts)) {
      return activities;
    }

    const parts = message.parts as Record<string, unknown>[];

    // Extract reasoning
    const reasoningText = parts
      .filter((part) => part.type === "reasoning")
      .map((part) => part.text as string)
      .join("");

    if (reasoningText) {
      const reasoningActivity: ReasoningActivity = {
        id: `${message.id}-reasoning`,
        type: "reasoning",
        content: reasoningText,
      };
      activities.push(reasoningActivity);
    }

    // Extract tool calls - AI SDK uses "tool-${toolName}" format for part.type
    parts
      .filter((part) => typeof part.type === "string" && (part.type as string).startsWith("tool-"))
      .forEach((part, index) => {
        const partType = part.type as string;
        // Extract tool name from "tool-${toolName}" format
        const toolName = partType.slice(5); // Remove "tool-" prefix
        const state = part.state as string;

        // Determine status based on AI SDK state values
        let status: "running" | "completed" | "failed" = "running";
        if (state === "output-available") {
          status = "completed";
        } else if (state === "output-error") {
          status = "failed";
        }

        const toolActivity: ToolCallActivity = {
          id: `${message.id}-tool-${index}`,
          type: "tool_call",
          callId: part.toolCallId as string,
          toolName: toolName,
          args: part.input as Record<string, unknown>, // AI SDK uses "input" not "args"
          status,
          result: state === "output-available" && part.output
            ? JSON.stringify(part.output)
            : undefined,
          error: state === "output-error" && part.errorText
            ? (part.errorText as string)
            : undefined,
        };
        activities.push(toolActivity);
      });

    return activities;
  }

  /**
   * Convert loaded items to activities (merging tool_call and tool_result by callId)
   */
  static itemsToActivities(
    loadedItems: Item[],
    messageId: string,
    toolResultsByCallId?: Map<string, Item>
  ): AgentActivity[] {
    const activities: AgentActivity[] = [];

    // Use provided map or build one from loadedItems
    const resultsMap = toolResultsByCallId ?? new Map<string, Item>();
    if (!toolResultsByCallId) {
      for (const item of loadedItems) {
        if (item.type === "tool_result") {
          resultsMap.set(item.callId, item);
        }
      }
    }

    for (const item of loadedItems) {
      switch (item.type) {
        case "reasoning":
          activities.push({
            id: item.id,
            type: "reasoning",
            content: item.reasoningContent,
            summary: item.reasoningSummary || undefined,
            timestamp: item.createdAt,
          });
          break;

        case "tool_call": {
          // Find matching tool_result and merge
          const resultItem = resultsMap.get(item.callId);
          activities.push({
            id: item.id,
            type: "tool_call",
            callId: item.callId,
            toolName: item.toolName,
            args: item.toolArgs || undefined,
            status: item.toolStatus,
            timestamp: item.createdAt,
            // Merge result/error from tool_result item
            result: resultItem?.type === "tool_result" ? (resultItem.toolOutput || undefined) : undefined,
            error: resultItem?.type === "tool_result" ? (resultItem.toolError || undefined) : undefined,
          });
          break;
        }

        // Skip tool_result - it's merged into tool_call above
        case "tool_result":
          break;
      }
    }

    return activities;
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
    let currentActivities: AgentActivity[] = [];

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
            activities: currentActivities.length > 0 ? [...currentActivities] : undefined,
          });
          currentParts = [];
          currentActivities = [];
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
        // Reasoning - add as part and activity
        currentParts.push({
          type: "reasoning",
          id: item.id,
          content: item.reasoningContent,
          summary: item.reasoningSummary || undefined,
        } as ReasoningContentPart);

        currentActivities.push({
          id: item.id,
          type: "reasoning",
          content: item.reasoningContent,
          summary: item.reasoningSummary || undefined,
          timestamp: item.createdAt,
        });
      } else if (item.type === "tool_call") {
        // Tool call - add as part and activity
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

        currentActivities.push({
          id: item.id,
          type: "tool_call",
          callId: item.callId,
          toolName: item.toolName,
          args: item.toolArgs || undefined,
          status: item.toolStatus,
          timestamp: item.createdAt,
          result: toolPart.result,
          error: toolPart.error,
        });
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
        activities: currentActivities.length > 0 ? [...currentActivities] : undefined,
      });
    }

    return messages;
  }

  /**
   * Merge loaded items with streaming messages from AI SDK
   */
  static mergeWithStreaming(
    loadedItems: Item[],
    rawMessages: Record<string, unknown>[]
  ): ChatMessage[] {
    // Start with loaded items converted to messages
    const fromItems = ItemTransformer.itemsToChatMessages(loadedItems);

    // Find new messages from streaming that aren't in loaded items
    const loadedMessageIds = new Set(
      loadedItems.filter((i) => i.type === "message").map((i) => i.id)
    );

    const streamingMessages = rawMessages
      .filter((msg) => !loadedMessageIds.has(msg.id as string))
      .map((msg) => ({
        id: msg.id as string,
        role: msg.role as "user" | "assistant" | "system",
        content: ItemTransformer.extractContent(msg),
        parts: ItemTransformer.extractContentPartsFromStreamingMessage(msg),
        activities: ItemTransformer.extractActivitiesFromParts(msg),
      }));

    return [...fromItems, ...streamingMessages];
  }
}

// Export standalone functions for convenience
export const extractContent = ItemTransformer.extractContent;
export const extractActivitiesFromParts = ItemTransformer.extractActivitiesFromParts;
export const extractContentPartsFromStreamingMessage = ItemTransformer.extractContentPartsFromStreamingMessage;
export const itemsToActivities = ItemTransformer.itemsToActivities;
export const itemsToContentParts = ItemTransformer.itemsToContentParts;
export const itemsToChatMessages = ItemTransformer.itemsToChatMessages;
export const mergeWithStreaming = ItemTransformer.mergeWithStreaming;
