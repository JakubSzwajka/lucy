"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import type { ChatMessage, AgentActivity, ReasoningActivity } from "@/types";

interface UsePersistentChatOptions {
  conversationId: string | null;
  model: string;
}

// Helper to extract text content from UIMessage parts
function extractContent(message: any): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");
  }
  return "";
}

// Helper to extract activities from UIMessage parts
function extractActivities(message: any): AgentActivity[] {
  const activities: AgentActivity[] = [];

  if (Array.isArray(message.parts)) {
    // Extract reasoning as an activity
    const reasoningText = message.parts
      .filter((part: any) => part.type === "reasoning")
      .map((part: any) => part.text)
      .join("");

    if (reasoningText) {
      const reasoningActivity: ReasoningActivity = {
        id: `${message.id}-reasoning`,
        type: "reasoning",
        content: reasoningText,
      };
      activities.push(reasoningActivity);
    }

    // Future: Extract tool calls, results, etc.
    // message.parts.filter(p => p.type === "tool-invocation").forEach(...)
  }

  return activities;
}

export function usePersistentChat({ conversationId, model }: UsePersistentChatOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const prevConversationIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const conversationIdRef = useRef(conversationId);

  // Keep refs updated
  modelRef.current = model;
  conversationIdRef.current = conversationId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          model: modelRef.current,
          conversationId: conversationIdRef.current,
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

  // Convert raw messages to our ChatMessage format
  const messages: ChatMessage[] = rawMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: extractContent(msg),
    model: (msg as any).model,
    activities: extractActivities(msg),
  }));

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId && conversationId !== prevConversationIdRef.current) {
      prevConversationIdRef.current = conversationId;
      setIsInitialized(false);

      fetch(`/api/conversations/${conversationId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          const loadedMessages = data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }));
          setMessages(loadedMessages);
          setIsInitialized(true);
        })
        .catch((error) => {
          console.error("Failed to load messages:", error);
          setIsInitialized(true);
        });
    } else if (!conversationId) {
      prevConversationIdRef.current = null;
      setMessages([]);
      setIsInitialized(true);
    }
  }, [conversationId, setMessages]);

  // Save user message to database before sending
  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return;

      // Save user message to database
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content,
          model,
        }),
      });

      // Send to AI
      chatSendMessage({ text: content });
    },
    [conversationId, model, chatSendMessage]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    isInitialized,
  };
}
