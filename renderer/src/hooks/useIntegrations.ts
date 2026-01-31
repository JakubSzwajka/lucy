"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Integration, IntegrationUpdate, IntegrationTestResult } from "@/types";

// Tool count per integration (keep in sync with actual tools)
const TOOL_COUNTS: Record<string, number> = {
  filesystem: 4, // fs_list_files, fs_read_file, fs_write_file, fs_delete_file
  obsidian: 4,   // obsidian_list_notes, obsidian_read_note, obsidian_write_note, obsidian_delete_note
  todoist: 2,    // todoist_list_tasks, todoist_list_projects
};

function estimateToolCount(integration: Integration): number {
  if (!integration.isConfigured || !integration.enabled) return 0;
  return TOOL_COUNTS[integration.id] ?? 0;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/integrations");
      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }
      const data = await response.json();
      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Computed: enabled and configured integrations
  const enabledIntegrations = useMemo(
    () => integrations.filter((i) => i.isConfigured && i.enabled),
    [integrations]
  );

  // Computed: total estimated tool count
  const totalTools = useMemo(
    () => enabledIntegrations.reduce((acc, i) => acc + estimateToolCount(i), 0),
    [enabledIntegrations]
  );

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const updateIntegration = useCallback(
    async (id: string, data: IntegrationUpdate): Promise<Integration> => {
      const response = await fetch(`/api/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update integration");
      }

      const updated = await response.json();
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                enabled: updated.enabled,
                isConfigured: updated.isConfigured,
                config: updated.config,
                updatedAt: updated.updatedAt,
              }
            : i
        )
      );
      return updated;
    },
    []
  );

  const deleteIntegration = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/integrations/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete integration");
    }

    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, enabled: false, isConfigured: false, config: null }
          : i
      )
    );
  }, []);

  const testConnection = useCallback(
    async (
      id: string,
      credentials: Record<string, string>
    ): Promise<IntegrationTestResult> => {
      const response = await fetch(`/api/integrations/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });

      const result = await response.json();
      return result;
    },
    []
  );

  // Quick toggle for chat UI
  const toggleIntegration = useCallback(
    async (id: string, enabled: boolean) => {
      // Optimistic update
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, enabled } : i))
      );

      try {
        await updateIntegration(id, { enabled });
      } catch (err) {
        // Revert on error
        setIntegrations((prev) =>
          prev.map((i) => (i.id === id ? { ...i, enabled: !enabled } : i))
        );
        throw err;
      }
    },
    [updateIntegration]
  );

  return {
    integrations,
    enabledIntegrations,
    totalTools,
    isLoading,
    error,
    updateIntegration,
    deleteIntegration,
    testConnection,
    toggleIntegration,
    refreshIntegrations: fetchIntegrations,
  };
}
