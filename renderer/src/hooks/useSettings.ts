"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserSettings, SettingsUpdate } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      } else {
        throw new Error("Failed to fetch settings");
      }
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
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (response.ok) {
          const data = await response.json();
          setSettings({
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          });
        } else {
          // Rollback on error
          setSettings(previousSettings);
          throw new Error("Failed to update settings");
        }
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
