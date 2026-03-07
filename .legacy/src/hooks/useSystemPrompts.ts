"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

function parsePrompt(p: SystemPrompt): SystemPrompt {
  return { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) };
}

const sortPrompts = (list: SystemPrompt[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export function useSystemPrompts() {
  const qc = useQueryClient();

  const { data: prompts = [], isLoading, error } = useQuery({
    queryKey: queryKeys.systemPrompts.all,
    queryFn: async () => {
      const data = await api.request<SystemPrompt[]>("/api/system-prompts");
      return sortPrompts(data.map(parsePrompt));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: SystemPromptCreate) => {
      const created = await api.request<SystemPrompt>("/api/system-prompts", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return parsePrompt(created);
    },
    onSuccess: (prompt) => {
      qc.setQueryData<SystemPrompt[]>(queryKeys.systemPrompts.all, (prev) =>
        sortPrompts([...(prev ?? []), prompt])
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SystemPromptUpdate }) => {
      const updated = await api.request<SystemPrompt>(`/api/system-prompts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return parsePrompt(updated);
    },
    onSuccess: (prompt) => {
      qc.setQueryData<SystemPrompt[]>(queryKeys.systemPrompts.all, (prev) =>
        sortPrompts((prev ?? []).map((p) => (p.id === prompt.id ? prompt : p)))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.request(`/api/system-prompts/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<SystemPrompt[]>(queryKeys.systemPrompts.all, (prev) =>
        (prev ?? []).filter((p) => p.id !== id)
      );
    },
  });

  const createPrompt = useCallback(
    (data: SystemPromptCreate) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updatePrompt = useCallback(
    (id: string, data: SystemPromptUpdate) => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deletePrompt = useCallback(
    (id: string) => deleteMutation.mutateAsync(id).then(() => {}),
    [deleteMutation]
  );

  const refreshPrompts = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.systemPrompts.all });
  }, [qc]);

  return {
    prompts,
    isLoading,
    error: error ?? null,
    createPrompt,
    updatePrompt,
    deletePrompt,
    refreshPrompts,
  };
}
