"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [dbPlan, setDbPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevStreamPlanRef = useRef<Plan | null>(streamPlan);

  const fetchPlan = useCallback(async () => {
    if (!sessionId) {
      setDbPlan(null);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/plans`);
      if (response.ok) {
        const data = await response.json();
        setDbPlan(data.plan);
        setError(null);
      } else {
        setError("Failed to fetch plan");
      }
    } catch (err) {
      console.error("[Plan] Failed to fetch:", err);
      setError("Failed to fetch plan");
    }
  }, [sessionId]);

  // Initial fetch on mount / sessionId change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching pattern: setIsLoading gates UI loading state before async fetch
    setIsLoading(true);
    fetchPlan().finally(() => setIsLoading(false));
  }, [fetchPlan]);

  // Re-fetch from DB when streamPlan transitions from non-null to null
  // (stream ended, session switch, etc.)
  useEffect(() => {
    if (prevStreamPlanRef.current && !streamPlan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchPlan sets state internally after async DB fetch
      fetchPlan();
    }
    prevStreamPlanRef.current = streamPlan;
  }, [streamPlan, fetchPlan]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchPlan();
    setIsLoading(false);
  }, [fetchPlan]);

  // Stream wins when available
  const plan = streamPlan ?? dbPlan;

  return {
    plan,
    isLoading,
    error,
    refresh,
  };
}
