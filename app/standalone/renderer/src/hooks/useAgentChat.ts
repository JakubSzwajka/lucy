"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { api, API_BASE_URL } from "@/lib/api/client";
import {
  mergeWithStreaming,
} from "@/lib/services/item/item.transformer";
import { extractPlanFromMessages } from "./usePlanStream";
import type { Plan } from "@/components/plan";
import type { UIMessage, ChatStatus } from "ai";
import type { ChatMessage, Item, MessageItem, Agent, SessionWithAgents } from "@/types";

interface UseSessionChatOptions {
  sessionId: string | null;
  model: string;
}

interface SendMessageOptions {
  thinkingEnabled?: boolean;
}

interface UseSessionChatReturn {
  messages: ChatMessage[];
  items: Item[];
  agent: Agent | null;
  streamPlan: Plan | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  isLoading: boolean;
  isInitialized: boolean;
  rawMessages: UIMessage[];
  status: ChatStatus;
}

export function useSessionChat({
  sessionId,
  model,
}: UseSessionChatOptions): UseSessionChatReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedItems, setLoadedItems] = useState<Item[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);

  const prevSessionIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const thinkingEnabledRef = useRef(true);

  // Keep refs updated via effect to avoid ref mutation during render
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const [transport, setTransport] = useState(
    // eslint-disable-next-line react-hooks/refs -- refs are captured in a deferred `body` callback, not read during render
    () =>
      new DefaultChatTransport({
        api: sessionId
          ? `${API_BASE_URL}/api/sessions/${sessionId}/chat`
          : `${API_BASE_URL}/api/sessions/_/chat`,
        headers: () => {
          const token = api.getToken();
          return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
        },
        body: () => ({
          model: modelRef.current,
          thinkingEnabled: thinkingEnabledRef.current,
        }),
      })
  );

  // Recreate transport when sessionId changes
  useEffect(() => {
    setTransport(
      new DefaultChatTransport({
        api: sessionId
          ? `${API_BASE_URL}/api/sessions/${sessionId}/chat`
          : `${API_BASE_URL}/api/sessions/_/chat`,
        headers: () => {
          const token = api.getToken();
          return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
        },
        body: () => ({
          model: modelRef.current,
          thinkingEnabled: thinkingEnabledRef.current,
        }),
      })
    );
  }, [sessionId]);

  const {
    messages: rawMessages,
    sendMessage: chatSendMessage,
    status,
    setMessages,
  } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Load session data when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId;
      setIsInitialized(false);

      api.request<SessionWithAgents>(`/api/sessions/${sessionId}`)
        .then((data) => {
          // Find root agent from session data
          const rootAgent =
            data.agents?.find((a) => a.id === data.rootAgentId) ||
            data.agents?.[0];
          setAgent(rootAgent || null);

          // Get items from root agent
          const rootItems = rootAgent?.items || [];
          setLoadedItems(rootItems);

          // Convert items to messages for useChat
          const messageItems = rootItems.filter(
            (item): item is MessageItem => item.type === "message"
          );
          const chatMessages = messageItems.map((item) => ({
            id: item.id,
            role: item.role,
            parts: [{ type: "text" as const, text: item.content }],
          }));
          setMessages(chatMessages);
          setIsInitialized(true);
        })
        .catch((error) => {
          console.error("[Chat] Failed to load session:", error);
          setIsInitialized(true);
        });
    } else if (!sessionId) {
      prevSessionIdRef.current = null;
      setMessages([]);
      setLoadedItems([]);
      setAgent(null);
      setIsInitialized(true);
    }
  }, [sessionId, setMessages]);

  // Combine loaded items with streaming messages using ItemTransformer
  const messages: ChatMessage[] = useMemo(() => {
    return mergeWithStreaming(loadedItems, rawMessages);
  }, [loadedItems, rawMessages]);

  // All items (loaded + inferred from streaming)
  const items: Item[] = useMemo(() => {
    return loadedItems;
  }, [loadedItems]);

  // Extract plan state from streaming tool results
  const streamPlan = useMemo(() => extractPlanFromMessages(rawMessages), [rawMessages]);

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!sessionId) return;

      // Update thinking preference for this message
      thinkingEnabledRef.current = options?.thinkingEnabled ?? true;

      // Just send to AI - server saves user message
      chatSendMessage({ text: content });
    },
    [sessionId, chatSendMessage]
  );

  return {
    messages,
    items,
    agent,
    streamPlan,
    sendMessage,
    isLoading,
    isInitialized,
    rawMessages,
    status,
  };
}
