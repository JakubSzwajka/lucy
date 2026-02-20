"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { IdentityDocument } from "@/types/memory";

export function useIdentity() {
  const qc = useQueryClient();

  const { data: identity, isLoading } = useQuery({
    queryKey: queryKeys.identity.active,
    queryFn: () => api.getIdentity() as unknown as Promise<IdentityDocument | null>,
  });

  const { data: history = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: queryKeys.identity.history,
    queryFn: () => api.getIdentityHistory() as unknown as unknown as Promise<IdentityDocument[]>,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateIdentity() as unknown as Promise<IdentityDocument>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.identity.active });
      qc.invalidateQueries({ queryKey: queryKeys.identity.history });
    },
  });

  return {
    identity: identity ?? null,
    history,
    isLoading,
    isLoadingHistory,
    generateIdentity: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
  };
}
