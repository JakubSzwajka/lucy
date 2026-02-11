"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
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
  const plan = streamPlan ?? dbPlan;

  return {
    plan,
    isLoading,
    error: queryError ? "Failed to fetch plan" : null,
    refresh,
  };
}
