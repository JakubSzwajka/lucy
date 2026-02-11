"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

export function useQuickActions() {
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      setError(null);
      const data = await api.request<QuickAction[]>("/api/quick-actions");
      setActions(
        data.map((a) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }))
      );
    } catch (err) {
      console.error("[QuickActions] Failed to fetch:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const createAction = useCallback(
    async (data: QuickActionCreate): Promise<QuickAction> => {
      const created = await api.request<QuickAction>("/api/quick-actions", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const action: QuickAction = {
        ...created,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
      };

      setActions((prev) =>
        [...prev, action].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
        )
      );
      return action;
    },
    []
  );

  const updateAction = useCallback(
    async (id: string, data: QuickActionUpdate): Promise<QuickAction> => {
      const updated = await api.request<QuickAction>(`/api/quick-actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const action: QuickAction = {
        ...updated,
        createdAt: new Date(updated.createdAt),
        updatedAt: new Date(updated.updatedAt),
      };

      setActions((prev) =>
        prev
          .map((a) => (a.id === id ? action : a))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
      return action;
    },
    []
  );

  const deleteAction = useCallback(async (id: string): Promise<void> => {
    await api.request(`/api/quick-actions/${id}`, {
      method: "DELETE",
    });

    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const refreshActions = useCallback(() => {
    setIsLoading(true);
    fetchActions();
  }, [fetchActions]);

  return {
    actions,
    isLoading,
    error,
    createAction,
    updateAction,
    deleteAction,
    refreshActions,
  };
}
