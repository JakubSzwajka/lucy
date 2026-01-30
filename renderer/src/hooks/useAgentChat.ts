"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  ItemTransformer,
  itemsToChatMessages,
  mergeWithStreaming,
} from "@/lib/services/item/item.transformer";
import type { ChatMessage, Item, Agent } from "@/types";

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

  // Combine loaded items with streaming messages using ItemTransformer
  const messages: ChatMessage[] = useMemo(() => {
    return mergeWithStreaming(
      loadedItems,
      rawMessages as unknown as Record<string, unknown>[]
    );
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
