"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { UserSettings, SettingsUpdate } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const data = await api.request<Record<string, unknown>>("/api/settings");
      setSettings({
        ...data,
        createdAt: new Date(data.createdAt as string),
        updatedAt: new Date(data.updatedAt as string),
      } as UserSettings);
    } catch (err) {
      console.error("[Settings] Failed to fetch:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: SettingsUpdate) => {
      if (!settings) return;

      // Optimistic update
      const previousSettings = settings;
      setSettings({
        ...settings,
        ...updates,
        updatedAt: new Date(),
      });

      try {
        const data = await api.request<Record<string, unknown>>("/api/settings", {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        setSettings({
          ...data,
          createdAt: new Date(data.createdAt as string),
          updatedAt: new Date(data.updatedAt as string),
        } as UserSettings);
      } catch (err) {
        // Rollback on error
        setSettings(previousSettings);
        console.error("[Settings] Failed to update:", err);
        throw err;
      }
    },
    [settings]
  );

  const refreshSettings = useCallback(() => {
    setIsLoading(true);
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    refreshSettings,
  };
}
