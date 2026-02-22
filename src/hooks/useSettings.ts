"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { UserSettings, SettingsUpdate } from "@/types";

function parseSettings(data: Record<string, unknown>): UserSettings {
  return {
    ...data,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
  } as UserSettings;
}

export function useSettings() {
  const qc = useQueryClient();

  const { data: settings = null, isLoading, error } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const data = await api.request<Record<string, unknown>>("/api/settings");
      return parseSettings(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: SettingsUpdate) => {
      const data = await api.request<Record<string, unknown>>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      return parseSettings(data);
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: queryKeys.settings });
      const previous = qc.getQueryData<UserSettings>(queryKeys.settings);
      if (previous) {
        qc.setQueryData<UserSettings>(queryKeys.settings, {
          ...previous,
          ...updates,
          updatedAt: new Date(),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.settings, context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.settings, data);
    },
  });

  const updateSettings = useCallback(
    async (updates: SettingsUpdate) => {
      await updateMutation.mutateAsync(updates);
    },
    [updateMutation]
  );

  const refreshSettings = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.settings });
  }, [qc]);

  return {
    settings,
    isLoading,
    error: error ?? null,
    updateSettings,
    refreshSettings,
  };
}
