"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { Memory, MemoryWithEvidence, MemoryFilters, CreateMemoryInput, UpdateMemoryInput } from "@/types/memory";

function buildParams(filters: MemoryFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.minConfidence != null) params.minConfidence = String(filters.minConfidence);
  if (filters.search) params.search = filters.search;
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.offset) params.offset = String(filters.offset);
  return params;
}

export function useMemories(filters: MemoryFilters = {}) {
  const qc = useQueryClient();
  const params = buildParams(filters);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: queryKeys.memories.list(params),
    queryFn: () => api.listMemories(Object.keys(params).length ? params : undefined) as unknown as Promise<Memory[]>,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateMemoryInput) => api.createMemory(input as unknown as Record<string, unknown>) as unknown as Promise<Memory>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memories.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateMemoryInput }) =>
      api.updateMemory(id, updates as unknown as Record<string, unknown>) as unknown as Promise<Memory>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memories.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMemory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memories.all });
    },
  });

  return {
    memories,
    isLoading,
    createMemory: createMutation.mutateAsync,
    updateMemory: useCallback(
      (id: string, updates: UpdateMemoryInput) => updateMutation.mutateAsync({ id, updates }),
      [updateMutation]
    ),
    deleteMemory: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useMemoryDetail(id: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.memories.detail(id ?? ""),
    queryFn: () => api.getMemory(id!) as unknown as Promise<MemoryWithEvidence>,
    enabled: !!id,
  });

  return { memory: data ?? null, isLoading };
}
