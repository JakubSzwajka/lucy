"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { ModelConfig } from "@/types";

export function useModels() {
  const { data: models = [], isLoading } = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api.request<ModelConfig[]>("/api/models"),
    staleTime: 5 * 60 * 1000,
  });

  const defaultModel = models[0] ?? null;

  const getModelConfig = useCallback(
    (modelId: string): ModelConfig | undefined =>
      models.find((m) => m.id === modelId),
    [models]
  );

  return useMemo(
    () => ({ models, defaultModel, getModelConfig, isLoading }),
    [models, defaultModel, getModelConfig, isLoading]
  );
}
