"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { MemorySettingsData } from "@/types/memory";

export function useMemorySettings() {
  return useQuery({
    queryKey: queryKeys.memorySettings,
    queryFn: () => api.getMemorySettings() as unknown as Promise<MemorySettingsData>,
  });
}

export function useUpdateMemorySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MemorySettingsData>) =>
      api.updateMemorySettings(input as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memorySettings });
    },
  });
}
