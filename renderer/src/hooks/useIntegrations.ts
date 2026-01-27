"use client";

import { useState, useEffect, useCallback } from "react";
import type { Integration, IntegrationUpdate, IntegrationTestResult } from "@/types";

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

  return {
    integrations,
    isLoading,
    error,
    updateIntegration,
    deleteIntegration,
    testConnection,
    refreshIntegrations: fetchIntegrations,
  };
}
