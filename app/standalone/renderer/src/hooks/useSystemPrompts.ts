"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

export function useSystemPrompts() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrompts = useCallback(async () => {
    try {
      setError(null);
      const data = await api.request<SystemPrompt[]>("/api/system-prompts");
      setPrompts(
        data.map((p) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }))
      );
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
      const created = await api.request<SystemPrompt>("/api/system-prompts", {
        method: "POST",
        body: JSON.stringify(data),
      });
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
      const updated = await api.request<SystemPrompt>(`/api/system-prompts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
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
    await api.request(`/api/system-prompts/${id}`, {
      method: "DELETE",
    });

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
