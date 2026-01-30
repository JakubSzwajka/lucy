import type {
  Item,
  ChatMessage,
  AgentActivity,
  ReasoningActivity,
  ToolCallActivity,
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
   * Convert items to ChatMessages for display
   */
  static itemsToChatMessages(loadedItems: Item[]): ChatMessage[] {
    const messages: ChatMessage[] = [];
    let currentActivities: AgentActivity[] = [];

    // Build tool_results map upfront for merging with tool_calls
    const toolResultsByCallId = new Map<string, Item>();
    for (const item of loadedItems) {
      if (item.type === "tool_result") {
        toolResultsByCallId.set(item.callId, item);
      }
    }

    for (const item of loadedItems) {
      if (item.type === "message") {
        // Attach any preceding activities to this message
        messages.push({
          id: item.id,
          role: item.role,
          content: item.content,
          createdAt: item.createdAt,
          activities: currentActivities.length > 0 ? [...currentActivities] : undefined,
        });
        currentActivities = [];
      } else if (item.type === "tool_result") {
        // Skip tool_result - it's merged into tool_call
        continue;
      } else {
        // Accumulate activities until next message
        const activity = ItemTransformer.itemsToActivities([item], item.id, toolResultsByCallId);
        currentActivities.push(...activity);
      }
    }

    // If there are trailing activities without a message, attach to last message
    if (currentActivities.length > 0 && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      lastMessage.activities = [
        ...(lastMessage.activities || []),
        ...currentActivities,
      ];
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
        activities: ItemTransformer.extractActivitiesFromParts(msg),
      }));

    return [...fromItems, ...streamingMessages];
  }
}

// Export standalone functions for convenience
export const extractContent = ItemTransformer.extractContent;
export const extractActivitiesFromParts = ItemTransformer.extractActivitiesFromParts;
export const itemsToActivities = ItemTransformer.itemsToActivities;
export const itemsToChatMessages = ItemTransformer.itemsToChatMessages;
export const mergeWithStreaming = ItemTransformer.mergeWithStreaming;
