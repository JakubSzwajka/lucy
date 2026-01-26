"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@/types";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        // Convert timestamps to Date objects
        setSessions(
          data.map((s: Record<string, unknown>) => ({
            ...s,
            createdAt: new Date(s.createdAt as string),
            updatedAt: new Date(s.updatedAt as string),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(async (title?: string) => {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const newSession = await response.json();
        const session: Session = {
          ...newSession,
          createdAt: new Date(newSession.createdAt),
          updatedAt: new Date(newSession.updatedAt),
        };
        setSessions((prev) => [session, ...prev]);
        return session;
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
    return null;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
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
