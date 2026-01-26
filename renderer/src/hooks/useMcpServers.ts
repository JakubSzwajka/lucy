"use client";

import { useState, useEffect, useCallback } from "react";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";

export function useMcpServers() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/mcp-servers");
      if (!response.ok) {
        throw new Error("Failed to fetch MCP servers");
      }
      const data = await response.json();
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
    const response = await fetch("/api/mcp-servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create MCP server");
    }

    const newServer = await response.json();
    setServers((prev) => [...prev, newServer]);
    return newServer;
  }, []);

  const updateServer = useCallback(async (id: string, data: McpServerUpdate): Promise<McpServer> => {
    const response = await fetch(`/api/mcp-servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update MCP server");
    }

    const updatedServer = await response.json();
    setServers((prev) =>
      prev.map((s) => (s.id === id ? updatedServer : s))
    );
    return updatedServer;
  }, []);

  const deleteServer = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete MCP server");
    }

    setServers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; tools?: string[]; error?: string }> => {
    const response = await fetch(`/api/mcp-servers/${id}/test`, {
      method: "POST",
    });

    const result = await response.json();
    return result;
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
