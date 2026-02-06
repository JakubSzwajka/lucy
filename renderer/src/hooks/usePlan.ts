"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Plan } from "@/components/plan";

interface UsePlanOptions {
  sessionId: string | null;
  /** Polling interval when plan is active (in ms). Default: 1500 */
  activePollingInterval?: number;
  /** Polling interval when no plan exists (in ms). Default: 3000 */
  idlePollingInterval?: number;
  /** Whether the agent is currently responding. Triggers refresh on transition to false. */
  isAgentResponding?: boolean;
}

interface UsePlanReturn {
  plan: Plan | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlan({
  sessionId,
  activePollingInterval = 1500,
  idlePollingInterval = 3000,
  isAgentResponding = false,
}: UsePlanOptions): UsePlanReturn {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevRespondingRef = useRef(isAgentResponding);

  const fetchPlan = useCallback(async () => {
    if (!sessionId) {
      setPlan(null);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/plans`);
      if (response.ok) {
        const data = await response.json();
        setPlan(data.plan);
        setError(null);
      } else {
        setError("Failed to fetch plan");
      }
    } catch (err) {
      console.error("[Plan] Failed to fetch:", err);
      setError("Failed to fetch plan");
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    fetchPlan().finally(() => setIsLoading(false));
  }, [fetchPlan]);

  // Refresh when agent finishes responding (transition from true to false)
  useEffect(() => {
    if (prevRespondingRef.current && !isAgentResponding) {
      // Agent just finished - refresh plan immediately
      fetchPlan();
    }
    prevRespondingRef.current = isAgentResponding;
  }, [isAgentResponding, fetchPlan]);

  // Continuous polling (always poll, but with different intervals)
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Determine polling interval based on plan state and agent activity
    let interval: number;

    if (isAgentResponding) {
      // Agent is actively responding - poll very frequently to show real-time updates
      interval = 800;
    } else if (!plan) {
      // No plan - poll slowly to detect new plan creation
      interval = idlePollingInterval;
    } else if (plan.status === "completed" || plan.status === "failed" || plan.status === "cancelled") {
      // Plan is done - no need to poll
      return;
    } else {
      // Active plan but agent idle - poll at normal rate
      interval = activePollingInterval;
    }

    intervalRef.current = setInterval(fetchPlan, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionId, plan?.status, isAgentResponding, activePollingInterval, idlePollingInterval, fetchPlan]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchPlan();
    setIsLoading(false);
  }, [fetchPlan]);

  return {
    plan,
    isLoading,
    error,
    refresh,
  };
}
