"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";

export function useMcpServers() {
  const qc = useQueryClient();

  const { data: servers = [], isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.mcpServers.all,
    queryFn: () => api.request<McpServer[]>("/api/mcp-servers"),
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Unknown error") : null;

  const createMutation = useMutation({
    mutationFn: (data: McpServerCreate) =>
      api.request<McpServer>("/api/mcp-servers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (server) => {
      qc.setQueryData<McpServer[]>(queryKeys.mcpServers.all, (prev) =>
        [...(prev ?? []), server]
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: McpServerUpdate }) =>
      api.request<McpServer>(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (server) => {
      qc.setQueryData<McpServer[]>(queryKeys.mcpServers.all, (prev) =>
        (prev ?? []).map((s) => (s.id === server.id ? server : s))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.request(`/api/mcp-servers/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<McpServer[]>(queryKeys.mcpServers.all, (prev) =>
        (prev ?? []).filter((s) => s.id !== id)
      );
    },
  });

  const createServer = useCallback(
    (data: McpServerCreate) => createMutation.mutateAsync(data),
    [createMutation]
  );

  const updateServer = useCallback(
    (id: string, data: McpServerUpdate) => updateMutation.mutateAsync({ id, data }),
    [updateMutation]
  );

  const deleteServer = useCallback(
    (id: string) => deleteMutation.mutateAsync(id).then(() => {}),
    [deleteMutation]
  );

  const testConnection = useCallback(
    (id: string) =>
      api.request<{ success: boolean; tools?: string[]; error?: string }>(
        `/api/mcp-servers/${id}/test`,
        { method: "POST" }
      ),
    []
  );

  const refreshServers = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.mcpServers.all });
  }, [qc]);

  return {
    servers,
    isLoading,
    error,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    refreshServers,
  };
}
