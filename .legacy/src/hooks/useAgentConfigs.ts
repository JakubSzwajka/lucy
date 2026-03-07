"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { AgentConfigWithTools, AgentConfigCreate, AgentConfigUpdate } from "@/types";

function parseConfig(c: AgentConfigWithTools): AgentConfigWithTools {
  return { ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) };
}

const sortConfigs = (list: AgentConfigWithTools[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export function useAgentConfigs() {
  const qc = useQueryClient();

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: queryKeys.agentConfigs.all,
    queryFn: async () => {
      const data = await api.listAgentConfigs();
      return sortConfigs(data.map(parseConfig));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: AgentConfigCreate) => {
      const created = await api.createAgentConfig(input);
      return parseConfig(created);
    },
    onSuccess: (config) => {
      qc.setQueryData<AgentConfigWithTools[]>(queryKeys.agentConfigs.all, (prev) =>
        sortConfigs([...(prev ?? []), config])
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AgentConfigUpdate }) => {
      const updated = await api.updateAgentConfig(id, data);
      return parseConfig(updated);
    },
    onSuccess: (config) => {
      qc.setQueryData<AgentConfigWithTools[]>(queryKeys.agentConfigs.all, (prev) =>
        sortConfigs((prev ?? []).map((c) => (c.id === config.id ? config : c)))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteAgentConfig(id);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<AgentConfigWithTools[]>(queryKeys.agentConfigs.all, (prev) =>
        (prev ?? []).filter((c) => c.id !== id)
      );
    },
  });

  const createConfig = useCallback(
    (data: AgentConfigCreate) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updateConfig = useCallback(
    (id: string, data: AgentConfigUpdate) => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteConfig = useCallback(
    (id: string) => deleteMutation.mutateAsync(id).then(() => {}),
    [deleteMutation]
  );

  const refreshConfigs = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.agentConfigs.all });
  }, [qc]);

  return {
    configs,
    isLoading,
    error: error ?? null,
    createConfig,
    updateConfig,
    deleteConfig,
    refreshConfigs,
  };
}
