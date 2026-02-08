"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { Session } from "@/types";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.request<Record<string, unknown>[]>("/api/sessions");
      setSessions(
        data.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt as string),
          updatedAt: new Date(s.updatedAt as string),
        })) as Session[]
      );
    } catch (error) {
      console.error("[Sessions] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(async (title?: string) => {
    try {
      const newSession = await api.request<Record<string, unknown>>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      const session: Session = {
        ...newSession,
        createdAt: new Date(newSession.createdAt as string),
        updatedAt: new Date(newSession.updatedAt as string),
      } as Session;
      setSessions((prev) => [session, ...prev]);
      return session;
    } catch (error) {
      console.error("[Sessions] Failed to create:", error);
    }
    return null;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await api.request(`/api/sessions/${id}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (error) {
      console.error("[Sessions] Failed to delete:", error);
    }
    return false;
  }, []);

  const refreshSessions = useCallback(() => {
    setIsLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    createSession,
    deleteSession,
    refreshSessions,
  };
}
