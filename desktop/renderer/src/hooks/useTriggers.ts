"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Trigger, TriggerCreate, TriggerUpdate, TriggerRun } from "@/types";

function parseTrigger(t: Trigger): Trigger {
  return { ...t, createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt) };
}

const sortTriggers = (list: Trigger[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export function useTriggers() {
  const qc = useQueryClient();

  const { data: triggers = [], isLoading, error } = useQuery({
    queryKey: queryKeys.triggers.all,
    queryFn: async () => {
      const data = await api.listTriggers();
      return sortTriggers(data.map(parseTrigger));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: TriggerCreate) => {
      const created = await api.createTrigger(input);
      return parseTrigger(created);
    },
    onSuccess: (trigger) => {
      qc.setQueryData<Trigger[]>(queryKeys.triggers.all, (prev) =>
        sortTriggers([...(prev ?? []), trigger])
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TriggerUpdate }) => {
      const updated = await api.updateTrigger(id, data);
      return parseTrigger(updated);
    },
    onSuccess: (trigger) => {
      qc.setQueryData<Trigger[]>(queryKeys.triggers.all, (prev) =>
        sortTriggers((prev ?? []).map((t) => (t.id === trigger.id ? trigger : t)))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteTrigger(id);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Trigger[]>(queryKeys.triggers.all, (prev) =>
        (prev ?? []).filter((t) => t.id !== id)
      );
    },
  });

  const createTrigger = useCallback(
    (data: TriggerCreate) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updateTrigger = useCallback(
    (id: string, data: TriggerUpdate) => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteTrigger = useCallback(
    (id: string) => deleteMutation.mutateAsync(id).then(() => {}),
    [deleteMutation]
  );

  return {
    triggers,
    isLoading,
    error: error ?? null,
    createTrigger,
    updateTrigger,
    deleteTrigger,
  };
}

export function useTriggerRuns(triggerId: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.triggers.runs(triggerId ?? ""),
    queryFn: async () => {
      if (!triggerId) return { runs: [] as TriggerRun[], total: 0 };
      return api.getTriggerRuns(triggerId, 10, 0);
    },
    enabled: !!triggerId,
  });

  return {
    runs: data?.runs ?? [],
    total: data?.total ?? 0,
    isLoading,
    refetch,
  };
}
