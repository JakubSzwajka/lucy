"use client";

import { useState, useEffect, useCallback } from "react";
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
      const response = await fetch("/api/mcp-servers");
      if (response.ok) {
        const data = await response.json();
        setAllServers(data);
      }
    } catch (err) {
      console.error("Failed to fetch MCP servers:", err);
    }
  }, []);

  // Fetch status of enabled servers (and connect them)
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch("/api/mcp-servers/status");
      if (!response.ok) {
        throw new Error("Failed to fetch MCP status");
      }

      const data: McpStatusResponse = await response.json();
      setEnabledServers(data.servers);
      setTotalTools(data.totalTools);
    } catch (err) {
      console.error("Failed to fetch MCP status:", err);
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
        const response = await fetch(`/api/mcp-servers/${serverId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });

        if (!response.ok) {
          throw new Error("Failed to update server");
        }

        // Refresh status to get actual connection state
        await fetchStatus();
      } catch (err) {
        console.error("Failed to toggle MCP server:", err);
        // Revert on error
        await refresh();
      }
    },
    [allServers, fetchStatus, refresh]
  );

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

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
