"use client";

import { useState, useEffect, useCallback } from "react";
import type { Conversation } from "@/types";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        // Convert timestamps to Date objects
        setConversations(
          data.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(async (title?: string) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const newConversation = await response.json();
        const conversation = {
          ...newConversation,
          createdAt: new Date(newConversation.createdAt),
          updatedAt: new Date(newConversation.updatedAt),
        };
        setConversations((prev) => [conversation, ...prev]);
        return conversation;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
    return null;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        return true;
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
    return false;
  }, []);

  const refreshConversations = useCallback(() => {
    setIsLoading(true);
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    createConversation,
    deleteConversation,
    refreshConversations,
  };
}
