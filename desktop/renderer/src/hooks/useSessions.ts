"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Session } from "@/types";

function parseSession(s: Record<string, unknown>): Session {
  return {
    ...s,
    createdAt: new Date(s.createdAt as string),
    updatedAt: new Date(s.updatedAt as string),
  } as Session;
}

export function useSessions() {
  const qc = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: async () => {
      const data = await api.request<Record<string, unknown>[]>("/api/sessions");
      return data.map(parseSession);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params?: { title?: string; agentConfigId?: string }) => {
      const data = await api.request<Record<string, unknown>>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: params?.title, agentConfigId: params?.agentConfigId }),
      });
      return parseSession(data);
    },
    onSuccess: (session) => {
      qc.setQueryData<Session[]>(queryKeys.sessions.all, (prev) =>
        prev ? [session, ...prev] : [session]
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.request(`/api/sessions/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Session[]>(queryKeys.sessions.all, (prev) =>
        prev ? prev.filter((s) => s.id !== id) : []
      );
    },
  });

  const createSession = useCallback(
    async (title?: string, agentConfigId?: string) => {
      try {
        return await createMutation.mutateAsync({ title, agentConfigId });
      } catch (error) {
        console.error("[Sessions] Failed to create:", error);
        return null;
      }
    },
    [createMutation]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch (error) {
        console.error("[Sessions] Failed to delete:", error);
        return false;
      }
    },
    [deleteMutation]
  );

  const refreshSessions = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
  }, [qc]);

  return {
    sessions,
    isLoading,
    createSession,
    deleteSession,
    refreshSessions,
  };
}
