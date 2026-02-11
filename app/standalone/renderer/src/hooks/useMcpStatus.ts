"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { McpServer, McpServerStatus } from "@/types";

interface McpStatusResponse {
  servers: McpServerStatus[];
  totalTools: number;
  connectedCount: number;
}

interface UseMcpStatusResult {
  // All configured MCP servers (for the dropdown)
  allServers: McpServer[];
  // Enabled servers with connection status
  enabledServers: McpServerStatus[];
  totalTools: number;
  isLoading: boolean;
  error: string | null;
  // Toggle server enabled state globally
  toggleServer: (serverId: string, enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMcpStatus(): UseMcpStatusResult {
  const [allServers, setAllServers] = useState<McpServer[]>([]);
  const [enabledServers, setEnabledServers] = useState<McpServerStatus[]>([]);
  const [totalTools, setTotalTools] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all configured servers
  const fetchServers = useCallback(async () => {
    try {
      const data = await api.request<McpServer[]>("/api/mcp-servers");
      setAllServers(data);
    } catch (err) {
      console.error("[MCP] Failed to fetch servers:", err);
    }
  }, []);

  // Fetch status of enabled servers (and connect them)
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);

      const data = await api.request<McpStatusResponse>("/api/mcp-servers/status");
      setEnabledServers(data.servers);
      setTotalTools(data.totalTools);
    } catch (err) {
      console.error("[MCP] Failed to fetch status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  // Combined refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchServers(), fetchStatus()]);
    setIsLoading(false);
  }, [fetchServers, fetchStatus]);

  // Toggle server enabled state globally
  const toggleServer = useCallback(
    async (serverId: string, enabled: boolean) => {
      try {
        // Optimistic update for allServers
        setAllServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, enabled } : s))
        );

        // Optimistic update for enabledServers
        if (enabled) {
          const server = allServers.find((s) => s.id === serverId);
          if (server) {
            setEnabledServers((prev) => [
              ...prev,
              {
                serverId: server.id,
                serverName: server.name,
                connected: false,
                tools: [],
                requireApproval: server.requireApproval,
              },
            ]);
          }
        } else {
          setEnabledServers((prev) =>
            prev.filter((s) => s.serverId !== serverId)
          );
        }

        // Update server enabled state via API
        await api.request(`/api/mcp-servers/${serverId}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled }),
        });

        // Refresh status to get actual connection state
        await fetchStatus();
      } catch (err) {
        console.error("[MCP] Failed to toggle server:", err);
        // Revert on error
        await refresh();
      }
    },
    [allServers, fetchStatus, refresh]
  );

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchServers(), fetchStatus()]);
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchServers, fetchStatus]);

  return {
    allServers,
    enabledServers,
    totalTools,
    isLoading,
    error,
    toggleServer,
    refresh,
  };
}
