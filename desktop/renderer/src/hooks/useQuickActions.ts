"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

function parseAction(a: QuickAction): QuickAction {
  return { ...a, createdAt: new Date(a.createdAt), updatedAt: new Date(a.updatedAt) };
}

const sortActions = (list: QuickAction[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

export function useQuickActions() {
  const qc = useQueryClient();

  const { data: actions = [], isLoading, error } = useQuery({
    queryKey: queryKeys.quickActions.all,
    queryFn: async () => {
      const data = await api.request<QuickAction[]>("/api/quick-actions");
      return sortActions(data.map(parseAction));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: QuickActionCreate) => {
      const created = await api.request<QuickAction>("/api/quick-actions", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return parseAction(created);
    },
    onSuccess: (action) => {
      qc.setQueryData<QuickAction[]>(queryKeys.quickActions.all, (prev) =>
        sortActions([...(prev ?? []), action])
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: QuickActionUpdate }) => {
      const updated = await api.request<QuickAction>(`/api/quick-actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return parseAction(updated);
    },
    onSuccess: (action) => {
      qc.setQueryData<QuickAction[]>(queryKeys.quickActions.all, (prev) =>
        sortActions((prev ?? []).map((a) => (a.id === action.id ? action : a)))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.request(`/api/quick-actions/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<QuickAction[]>(queryKeys.quickActions.all, (prev) =>
        (prev ?? []).filter((a) => a.id !== id)
      );
    },
  });

  const createAction = useCallback(
    (data: QuickActionCreate) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updateAction = useCallback(
    (id: string, data: QuickActionUpdate) => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteAction = useCallback(
    (id: string) => deleteMutation.mutateAsync(id).then(() => {}),
    [deleteMutation]
  );

  const refreshActions = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.quickActions.all });
  }, [qc]);

  return {
    actions,
    isLoading,
    error: error ?? null,
    createAction,
    updateAction,
    deleteAction,
    refreshActions,
  };
}
