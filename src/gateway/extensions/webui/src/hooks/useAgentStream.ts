import { useCallback, useRef, useState } from "react";

import { sendMessageStream, getHistory } from "@/api/client";
import type { Item, StreamEvent, MessageItem, ToolCallItem, ToolResultItem, ReasoningItem } from "@/api/types";

/**
 * Hook that manages the chat items state and handles streaming updates.
 * Replaces the old "send then fetch" pattern with real-time item updates.
 */
export function useAgentStream(showActivity: boolean) {
  const [items, setItems] = useState<Item[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mutable refs for building up streaming state without re-renders per delta
  const pendingText = useRef("");
  const pendingThinking = useRef("");
  const sequenceRef = useRef(0);

  // Fetch full history from server (used on mount and after stream ends)
  const fetchItems = useCallback(async () => {
    try {
      const res = await getHistory(!showActivity);
      setItems(res.items);
      // Sync sequence counter
      const maxSeq = res.items.reduce((max, i) => Math.max(max, i.sequence), 0);
      sequenceRef.current = maxSeq + 1;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, [showActivity]);

  const nextSeq = () => sequenceRef.current++;

  const send = useCallback(async (message: string) => {
    // Optimistic user message
    const userItem: MessageItem = {
      id: `user-${Date.now()}`,
      agentId: "",
      sequence: nextSeq(),
      createdAt: new Date().toISOString(),
      type: "message",
      role: "user",
      content: message,
    };

    setItems((prev) => [...prev, userItem]);
    setStreaming(true);
    setError(null);
    pendingText.current = "";
    pendingThinking.current = "";

    // IDs for streaming items we build up incrementally
    const streamingMsgId = `stream-msg-${Date.now()}`;
    const streamingThinkingId = `stream-thinking-${Date.now()}`;

    const handleEvent = (event: StreamEvent) => {
      switch (event.type) {
        case "text_delta": {
          pendingText.current += event.delta;
          const text = pendingText.current;
          setItems((prev) => {
            const existing = prev.find((i) => i.id === streamingMsgId);
            if (existing) {
              return prev.map((i) =>
                i.id === streamingMsgId
                  ? { ...i, content: text } as MessageItem
                  : i,
              );
            }
            // First text delta — create the assistant message
            const item: MessageItem = {
              id: streamingMsgId,
              agentId: "",
              sequence: nextSeq(),
              createdAt: new Date().toISOString(),
              type: "message",
              role: "assistant",
              content: text,
            };
            return [...prev, item];
          });
          break;
        }

        case "thinking_delta": {
          if (!showActivity) break;
          pendingThinking.current += event.delta;
          const thinking = pendingThinking.current;
          setItems((prev) => {
            const existing = prev.find((i) => i.id === streamingThinkingId);
            if (existing) {
              return prev.map((i) =>
                i.id === streamingThinkingId
                  ? { ...i, reasoningContent: thinking } as ReasoningItem
                  : i,
              );
            }
            const item: ReasoningItem = {
              id: streamingThinkingId,
              agentId: "",
              sequence: nextSeq(),
              createdAt: new Date().toISOString(),
              type: "reasoning",
              reasoningContent: thinking,
            };
            return [...prev, item];
          });
          break;
        }

        case "tool_start": {
          if (!showActivity) break;
          const toolItem: ToolCallItem = {
            id: `tc-${event.toolCallId}`,
            agentId: "",
            sequence: nextSeq(),
            createdAt: new Date().toISOString(),
            type: "tool_call",
            callId: event.toolCallId,
            toolName: event.toolName,
            toolArgs: event.args,
            toolStatus: "running",
          };
          setItems((prev) => [...prev, toolItem]);
          break;
        }

        case "tool_end": {
          if (!showActivity) break;
          // Update the tool call status
          setItems((prev) =>
            prev.map((i) => {
              if (i.type === "tool_call" && i.callId === event.toolCallId) {
                return {
                  ...i,
                  toolStatus: event.isError ? "failed" : "completed",
                } as ToolCallItem;
              }
              return i;
            }),
          );

          // Add tool result
          const resultItem: ToolResultItem = {
            id: `tr-${event.toolCallId}`,
            agentId: "",
            sequence: nextSeq(),
            createdAt: new Date().toISOString(),
            type: "tool_result",
            callId: event.toolCallId,
            toolOutput: event.isError ? undefined : event.output || undefined,
            toolError: event.isError ? event.output || "Unknown error" : undefined,
          };
          setItems((prev) => [...prev, resultItem]);
          break;
        }

        case "agent_start": {
          // Reset streaming accumulators for new text after tool calls
          pendingText.current = "";
          pendingThinking.current = "";
          break;
        }

        case "error": {
          setError(event.error);
          break;
        }
      }
    };

    try {
      await sendMessageStream(message, handleEvent);
      // Stream ended — fetch canonical history to ensure consistency
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove optimistic user message on failure
      setItems((prev) => prev.filter((i) => i.id !== userItem.id));
    } finally {
      setStreaming(false);
      pendingText.current = "";
      pendingThinking.current = "";
    }
  }, [showActivity, fetchItems]);

  return { items, streaming, error, send, fetchItems };
}
