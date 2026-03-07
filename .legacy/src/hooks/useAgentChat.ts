"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { api, API_BASE_URL } from "@/lib/client/api/client";
import {
  mergeWithStreaming,
} from "@/lib/client/utils/item-transformer";
import { extractPlanFromMessages } from "./usePlanStream";
import type { Plan } from "@/components/plan";
import type { UIMessage, ChatStatus, FileUIPart } from "ai";
import type { ChatMessage, Item, MessageItem, Agent, SessionWithAgents, ChildSessionSummary, PaginatedItemsResponse } from "@/types";

/**
 * Reshapes the request body to send only the last user message instead of full history.
 * Note: sessionId is passed dynamically at sendMessage time, not in prepareSendMessage,
 * because useChat doesn't properly update the transport when sessionId changes.
 * See: https://github.com/vercel/ai/issues/7819
 */
function prepareSendMessage({ messages, body }: { messages: UIMessage[]; body: Record<string, unknown> | undefined }) {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const content =
    lastUserMessage?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";
  const fileParts = lastUserMessage?.parts?.filter((p) => p.type === "file") || [];
  const parts =
    fileParts.length > 0
      ? [
          ...fileParts.map((p) => ({
            type: p.type,
            url: "url" in p ? (p as { url: string }).url : undefined,
            mediaType: "mediaType" in p ? (p as { mediaType: string }).mediaType : undefined,
          })),
          ...(content ? [{ type: "text", text: content }] : []),
        ]
      : undefined;

  return {
    body: {
      sessionId: body?.sessionId,
      message: { content, parts },
      model: body?.model,
      thinkingEnabled: body?.thinkingEnabled,
      skipPersist: body?.skipPersist,
    },
  };
}

interface UseSessionChatOptions {
  sessionId: string | null;
  model: string;
}

interface SendMessageOptions {
  thinkingEnabled?: boolean;
  files?: FileUIPart[];
}

interface UseSessionChatReturn {
  messages: ChatMessage[];
  items: Item[];
  agent: Agent | null;
  childSessions: ChildSessionSummary[];
  streamPlan: Plan | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  rewindToMessage: (itemId: string, newContent: string) => Promise<void>;
  cancelGeneration: () => void;
  isLoading: boolean;
  isInitialized: boolean;
  rawMessages: UIMessage[];
  status: ChatStatus;
  hasMoreItems: boolean;
  isLoadingMore: boolean;
  loadMoreItems: () => Promise<void>;
}

export function useSessionChat({
  sessionId,
  model,
}: UseSessionChatOptions): UseSessionChatReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedItems, setLoadedItems] = useState<Item[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [childSessions, setChildSessions] = useState<ChildSessionSummary[]>([]);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const prevSessionIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const thinkingEnabledRef = useRef(true);

  // Keep refs updated via effect to avoid ref mutation during render
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // Static transport using generic /api/chat endpoint
  // SessionId is passed dynamically at sendMessage time to avoid stale state issues
  // See: https://github.com/vercel/ai/issues/7819
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${API_BASE_URL}/api/chat`,
    headers: () => {
      const token = api.getToken();
      return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
    },
    prepareSendMessagesRequest: prepareSendMessage,
    body: () => ({
      model: modelRef.current,
      thinkingEnabled: thinkingEnabledRef.current,
    }),
  }), []);

  const {
    messages: rawMessages,
    sendMessage: chatSendMessage,
    stop,
    status,
    setMessages,
  } = useChat({
    id: sessionId ?? "default",
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Load session data when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId;
      setIsInitialized(false);

      api.request<SessionWithAgents>(`/api/sessions/${sessionId}?itemsLimit=20`)
        .then((data) => {
          // Find root agent from session data
          const rootAgent =
            data.agents?.find((a) => a.id === data.rootAgentId) ||
            data.agents?.[0];
          setAgent(rootAgent || null);
          setChildSessions(data.childSessions || []);

          // Get items from root agent
          const rootItems = rootAgent?.items || [];
          setLoadedItems(rootItems);

          // Check if there are more items to load
          const totalCount = rootAgent?.itemsTotalCount ?? rootItems.length;
          setHasMoreItems(rootItems.length < totalCount);

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
      setChildSessions([]);
      setHasMoreItems(false);
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

  const loadMoreItems = useCallback(async () => {
    if (!sessionId || isLoadingMore || !hasMoreItems) return;
    setIsLoadingMore(true);
    try {
      const oldestSequence = loadedItems.length > 0 ? loadedItems[0].sequence : undefined;
      const params = new URLSearchParams({ limit: "20" });
      if (oldestSequence !== undefined) params.set("before", String(oldestSequence));

      const data = await api.request<PaginatedItemsResponse>(
        `/api/sessions/${sessionId}/items?${params.toString()}`
      );
      setLoadedItems((prev) => [...data.items, ...prev]);
      setHasMoreItems(data.hasMore);
    } catch (error) {
      console.error("[Chat] Failed to load more items:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionId, isLoadingMore, hasMoreItems, loadedItems]);

  const cancelGeneration = useCallback(() => {
    stop();
    setMessages((prev) => {
      const lastIndex = prev.findLastIndex((m) => m.role === "assistant");
      if (lastIndex === -1) return prev;
      return prev.slice(0, lastIndex);
    });
  }, [stop, setMessages]);

  const rewindToMessage = useCallback(
    async (itemId: string, newContent: string) => {
      if (!sessionId) return;

      const targetIndex = rawMessages.findIndex((m) => m.id === itemId);
      if (targetIndex === -1) return;

      // Optimistically truncate messages to BEFORE the target.
      // chatSendMessage will re-add the user message, so we exclude it here
      // to avoid duplicates in mergeWithStreaming.
      setMessages((prev) => prev.slice(0, targetIndex));

      // Truncate loaded items to before the target (exclusive)
      const targetItem = loadedItems.find((item) => item.id === itemId);
      if (targetItem) {
        setLoadedItems((prev) =>
          prev.filter((item) => item.sequence < targetItem.sequence)
        );
      }

      try {
        // Call rewind API to clean up DB and update the message content
        await api.rewindSession(sessionId, itemId, newContent);

        // Trigger generation through the normal useChat transport with skipPersist
        // since the user message already exists in DB
        thinkingEnabledRef.current = true;
        chatSendMessage(
          { text: newContent },
          { body: { sessionId, skipPersist: true } }
        );
      } catch (error) {
        console.error("[Chat] Rewind failed:", error);
        // Reload session to restore consistent state
        prevSessionIdRef.current = null;
      }
    },
    [sessionId, rawMessages, loadedItems, setMessages, chatSendMessage]
  );

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!sessionId) return;

      // Update thinking preference for this message
      thinkingEnabledRef.current = options?.thinkingEnabled ?? true;

      // Prepare parts
      let parts: Array<{ type: "text"; text: string } | FileUIPart> | undefined;
      if (options?.files && options.files.length > 0) {
        parts = [
          ...options.files,
          ...(content ? [{ type: "text" as const, text: content }] : []),
        ];
      }

      // Send with sessionId in the request options (passed to prepareSendMessage via body)
      chatSendMessage(
        parts ? { parts } : { text: content },
        {
          body: {
            sessionId,
          },
        }
      );
    },
    [sessionId, chatSendMessage]
  );

  return {
    messages,
    items,
    agent,
    childSessions,
    streamPlan,
    sendMessage,
    rewindToMessage,
    cancelGeneration,
    isLoading,
    isInitialized,
    rawMessages,
    status,
    hasMoreItems,
    isLoadingMore,
    loadMoreItems,
  };
}
