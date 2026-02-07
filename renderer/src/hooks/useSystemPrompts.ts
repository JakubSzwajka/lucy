"use client";

import { useState, useEffect, useCallback } from "react";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

export function useSystemPrompts() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrompts = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/system-prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(
          data.map((p: SystemPrompt) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          }))
        );
      } else {
        throw new Error("Failed to fetch system prompts");
      }
    } catch (err) {
      console.error("[SystemPrompts] Failed to fetch:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const createPrompt = useCallback(
    async (data: SystemPromptCreate): Promise<SystemPrompt> => {
      const response = await fetch("/api/system-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create system prompt");
      }

      const created = await response.json();
      const prompt: SystemPrompt = {
        ...created,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
      };

      setPrompts((prev) => [...prev, prompt].sort((a, b) => a.name.localeCompare(b.name)));
      return prompt;
    },
    []
  );

  const updatePrompt = useCallback(
    async (id: string, data: SystemPromptUpdate): Promise<SystemPrompt> => {
      const response = await fetch(`/api/system-prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update system prompt");
      }

      const updated = await response.json();
      const prompt: SystemPrompt = {
        ...updated,
        createdAt: new Date(updated.createdAt),
        updatedAt: new Date(updated.updatedAt),
      };

      setPrompts((prev) =>
        prev
          .map((p) => (p.id === id ? prompt : p))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      return prompt;
    },
    []
  );

  const deletePrompt = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/system-prompts/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete system prompt");
    }

    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const refreshPrompts = useCallback(() => {
    setIsLoading(true);
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    prompts,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    refreshPrompts,
  };
}
