"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { McpServer, McpServerStatus } from "@/types";

interface McpStatusResponse {
  servers: McpServerStatus[];
  totalTools: number;
  connectedCount: number;
}

interface UseMcpStatusResult {
  allServers: McpServer[];
  enabledServers: McpServerStatus[];
  totalTools: number;
  isLoading: boolean;
  error: string | null;
  toggleServer: (serverId: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMcpStatus(): UseMcpStatusResult {
  const qc = useQueryClient();

  const serversQuery = useQuery({
    queryKey: queryKeys.mcpServers.all,
    queryFn: () => api.request<McpServer[]>("/api/mcp-servers"),
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.mcpServers.status,
    queryFn: () => api.request<McpStatusResponse>("/api/mcp-servers/status"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ serverId, enabled }: { serverId: string; enabled: boolean }) => {
      await api.request(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
    },
    onMutate: async ({ serverId, enabled }) => {
      await qc.cancelQueries({ queryKey: queryKeys.mcpServers.all });
      await qc.cancelQueries({ queryKey: queryKeys.mcpServers.status });

      const prevServers = qc.getQueryData<McpServer[]>(queryKeys.mcpServers.all);
      const prevStatus = qc.getQueryData<McpStatusResponse>(queryKeys.mcpServers.status);

      // Optimistic update servers
      if (prevServers) {
        qc.setQueryData<McpServer[]>(
          queryKeys.mcpServers.all,
          prevServers.map((s) => (s.id === serverId ? { ...s, enabled } : s))
        );
      }

      // Optimistic update status
      if (prevStatus && prevServers) {
        if (enabled) {
          const server = prevServers.find((s) => s.id === serverId);
          if (server) {
            qc.setQueryData<McpStatusResponse>(queryKeys.mcpServers.status, {
              ...prevStatus,
              servers: [
                ...prevStatus.servers,
                {
                  serverId: server.id,
                  serverName: server.name,
                  connected: false,
                  tools: [],
                  requireApproval: server.requireApproval,
                },
              ],
            });
          }
        } else {
          qc.setQueryData<McpStatusResponse>(queryKeys.mcpServers.status, {
            ...prevStatus,
            servers: prevStatus.servers.filter((s) => s.serverId !== serverId),
          });
        }
      }

      return { prevServers, prevStatus };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevServers) {
        qc.setQueryData(queryKeys.mcpServers.all, context.prevServers);
      }
      if (context?.prevStatus) {
        qc.setQueryData(queryKeys.mcpServers.status, context.prevStatus);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.status });
    },
  });

  const toggleServer = useCallback(
    async (serverId: string, enabled: boolean) => {
      await toggleMutation.mutateAsync({ serverId, enabled });
    },
    [toggleMutation]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.all }),
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.status }),
    ]);
  }, [qc]);

  const isLoading = serversQuery.isLoading || statusQuery.isLoading;
  const error = serversQuery.error || statusQuery.error;

  return {
    allServers: serversQuery.data ?? [],
    enabledServers: statusQuery.data?.servers ?? [],
    totalTools: statusQuery.data?.totalTools ?? 0,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Unknown error") : null,
    toggleServer,
    refresh,
  };
}
