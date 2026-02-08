"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";

export function useMcpServers() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.request<McpServer[]>("/api/mcp-servers");
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const createServer = useCallback(async (data: McpServerCreate): Promise<McpServer> => {
    const newServer = await api.request<McpServer>("/api/mcp-servers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setServers((prev) => [...prev, newServer]);
    return newServer;
  }, []);

  const updateServer = useCallback(async (id: string, data: McpServerUpdate): Promise<McpServer> => {
    const updatedServer = await api.request<McpServer>(`/api/mcp-servers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    setServers((prev) =>
      prev.map((s) => (s.id === id ? updatedServer : s))
    );
    return updatedServer;
  }, []);

  const deleteServer = useCallback(async (id: string): Promise<void> => {
    await api.request(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    });

    setServers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; tools?: string[]; error?: string }> => {
    return api.request<{ success: boolean; tools?: string[]; error?: string }>(`/api/mcp-servers/${id}/test`, {
      method: "POST",
    });
  }, []);

  return {
    servers,
    isLoading,
    error,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    refreshServers: fetchServers,
  };
}
