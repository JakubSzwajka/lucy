"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { Plan } from "@/components/plan";

interface UsePlanOptions {
  sessionId: string | null;
  streamPlan?: Plan | null;
}

interface UsePlanReturn {
  plan: Plan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TERMINAL_STATUSES: Set<string> = new Set(["completed", "failed", "cancelled"]);

export function usePlan({
  sessionId,
  streamPlan = null,
}: UsePlanOptions): UsePlanReturn {
  const qc = useQueryClient();
  const prevStreamPlanRef = useRef<Plan | null>(streamPlan);

  const { data: dbPlan = null, isLoading, error: queryError } = useQuery({
    queryKey: sessionId ? queryKeys.plans.bySession(sessionId) : ["plans", "none"],
    queryFn: async () => {
      if (!sessionId) return null;
      const data = await api.request<{ plan: Plan | null }>(`/api/sessions/${sessionId}/plans`);
      return data.plan;
    },
    enabled: !!sessionId,
  });

  // Re-fetch from DB when streamPlan transitions from non-null to null
  useEffect(() => {
    if (prevStreamPlanRef.current && !streamPlan && sessionId) {
      qc.invalidateQueries({ queryKey: queryKeys.plans.bySession(sessionId) });
    }
    prevStreamPlanRef.current = streamPlan;
  }, [streamPlan, sessionId, qc]);

  const refresh = useCallback(async () => {
    if (sessionId) {
      await qc.invalidateQueries({ queryKey: queryKeys.plans.bySession(sessionId) });
    }
  }, [sessionId, qc]);

  // Stream wins when available
  const resolved = streamPlan ?? dbPlan;

  // ADR-0008: Hide terminal plans that were already terminal on page load.
  // A streamPlan means we witnessed the plan being created/updated live,
  // so we've seen it non-terminal. dbPlan alone with terminal status means
  // it was already done before this page load.
  const plan = useMemo(() => {
    if (!resolved) return null;
    if (!TERMINAL_STATUSES.has(resolved.status)) return resolved;
    // Terminal plan — only show if we witnessed it via streaming
    if (streamPlan) return resolved;
    return null;
  }, [resolved, streamPlan]);

  return {
    plan,
    isLoading,
    error: queryError ? "Failed to fetch plan" : null,
    refresh,
  };
}
