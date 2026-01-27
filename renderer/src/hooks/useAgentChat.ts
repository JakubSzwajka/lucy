"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import type {
  ChatMessage,
  AgentActivity,
  ReasoningActivity,
  ToolCallActivity,
  Item,
  Agent,
} from "@/types";

interface UseAgentChatOptions {
  sessionId: string | null;
  agentId: string | null;
  model: string;
}

interface SendMessageOptions {
  thinkingEnabled?: boolean;
}

interface UseAgentChatReturn {
  messages: ChatMessage[];
  items: Item[];
  agent: Agent | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  isLoading: boolean;
  isInitialized: boolean;
}

// Helper to extract text content from UIMessage parts
function extractContent(message: Record<string, unknown>): string {
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

// Helper to extract activities from UIMessage parts (streaming)
// AI SDK uses part.type = "tool-${toolName}" format (e.g., "tool-getWeather")
// States: "input-streaming", "input-available", "output-available", "output-error"
function extractActivitiesFromParts(message: Record<string, unknown>): AgentActivity[] {
  const activities: AgentActivity[] = [];

  if (Array.isArray(message.parts)) {
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
          // Include result/error directly in tool call activity
          result: state === "output-available" && part.output
            ? JSON.stringify(part.output)
            : undefined,
          error: state === "output-error" && part.errorText
            ? (part.errorText as string)
            : undefined,
        };
        activities.push(toolActivity);
      });
  }

  return activities;
}

// Convert loaded items to activities (merging tool_call and tool_result by callId)
function itemsToActivities(
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

// Convert items to ChatMessages for display
function itemsToChatMessages(loadedItems: Item[]): ChatMessage[] {
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
      const activity = itemsToActivities([item], item.id, toolResultsByCallId);
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

export function useAgentChat({
  sessionId,
  agentId,
  model,
}: UseAgentChatOptions): UseAgentChatReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedItems, setLoadedItems] = useState<Item[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);

  const prevAgentIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const agentIdRef = useRef(agentId);
  const thinkingEnabledRef = useRef(true);

  // Keep refs updated
  modelRef.current = model;
  agentIdRef.current = agentId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          model: modelRef.current,
          agentId: agentIdRef.current,
          thinkingEnabled: thinkingEnabledRef.current,
        }),
      }),
    []
  );

  const {
    messages: rawMessages,
    sendMessage: chatSendMessage,
    status,
    setMessages,
  } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Load agent and items when agentId changes
  useEffect(() => {
    if (agentId && agentId !== prevAgentIdRef.current) {
      prevAgentIdRef.current = agentId;
      setIsInitialized(false);

      // Fetch agent with items
      fetch(`/api/agents/${agentId}`)
        .then((res) => res.json())
        .then((data) => {
          setAgent(data);
          setLoadedItems(data.items || []);

          // Convert items to messages for useChat
          const messageItems = (data.items || []).filter(
            (item: Item) => item.type === "message"
          );
          const chatMessages = messageItems.map((item: Item) => ({
            id: item.id,
            role: (item as any).role,
            content: (item as any).content,
          }));
          setMessages(chatMessages);
          setIsInitialized(true);
        })
        .catch((error) => {
          console.error("Failed to load agent:", error);
          setIsInitialized(true);
        });
    } else if (!agentId) {
      prevAgentIdRef.current = null;
      setMessages([]);
      setLoadedItems([]);
      setAgent(null);
      setIsInitialized(true);
    }
  }, [agentId, setMessages]);

  // Combine loaded items with streaming messages
  const messages: ChatMessage[] = useMemo(() => {
    // Start with loaded items converted to messages
    const fromItems = itemsToChatMessages(loadedItems);

    // Find new messages from streaming that aren't in loaded items
    const loadedMessageIds = new Set(
      loadedItems.filter((i) => i.type === "message").map((i) => i.id)
    );

    const streamingMessages = rawMessages
      .filter((msg) => !loadedMessageIds.has(msg.id))
      .map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "system",
        content: extractContent(msg as unknown as Record<string, unknown>),
        activities: extractActivitiesFromParts(msg as unknown as Record<string, unknown>),
      }));

    return [...fromItems, ...streamingMessages];
  }, [loadedItems, rawMessages]);

  // All items (loaded + inferred from streaming)
  const items: Item[] = useMemo(() => {
    return loadedItems;
  }, [loadedItems]);

  // Save user message to database before sending
  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!agentId) return;

      // Update thinking preference for this message
      thinkingEnabledRef.current = options?.thinkingEnabled ?? true;

      // Save user message as an item (for persistence)
      // Note: Don't add to loadedItems here - chatSendMessage will add to rawMessages
      // and we combine them in the messages useMemo. Adding here would cause duplicates.
      await fetch(`/api/agents/${agentId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          role: "user",
          content,
        }),
      });

      // Send to AI - this adds the user message to rawMessages
      chatSendMessage({ text: content });
    },
    [agentId, chatSendMessage]
  );

  return {
    messages,
    items,
    agent,
    sendMessage,
    isLoading,
    isInitialized,
  };
}
