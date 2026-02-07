"use client";

import { useState, useEffect, useCallback } from "react";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

export function useQuickActions() {
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/quick-actions");
      if (response.ok) {
        const data = await response.json();
        setActions(
          data.map((a: QuickAction) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          }))
        );
      } else {
        throw new Error("Failed to fetch quick actions");
      }
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
      const response = await fetch("/api/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create quick action");

      const created = await response.json();
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
      const response = await fetch(`/api/quick-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update quick action");

      const updated = await response.json();
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
    const response = await fetch(`/api/quick-actions/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete quick action");

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
