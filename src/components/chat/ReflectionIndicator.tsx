"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useMemorySettings } from "@/hooks/useMemorySettings";
import { useQuestions } from "@/hooks/useQuestions";
import type { Session } from "@/types";

interface ReflectionIndicatorProps {
  sessionId: string | null;
  chatStatus?: string;
}

export function ReflectionIndicator({ sessionId, chatStatus }: ReflectionIndicatorProps) {
  const { data: settings } = useMemorySettings();
  const { questions: pendingQuestions } = useQuestions({ status: "pending" });
  const pendingCount = pendingQuestions.length;

  const { data: session } = useQuery({
    queryKey: ["session-reflection", sessionId, chatStatus],
    queryFn: async () => {
      const data = await api.request<Record<string, unknown>>(`/api/sessions/${sessionId}`);
      return data as unknown as Session;
    },
    enabled: !!sessionId && !!settings?.autoExtract,
    staleTime: 10_000,
  });

  const showSpinner = settings?.autoExtract && session;

  if (!showSpinner && pendingCount === 0) return null;

  const current = session?.reflectionTokenCount ?? 0;
  const threshold = settings?.reflectionTokenThreshold ?? 1;
  const progress = Math.min(current / threshold, 1);
  const pct = Math.round(progress * 100);

  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-3">
      {showSpinner && (
        <div
          className="flex items-center gap-1.5 text-xs text-muted-dark"
          title={`Auto-reflection: ${current.toLocaleString()} / ${threshold.toLocaleString()} tokens (${pct}%)`}
        >
          <span className="label-dark text-[10px]">MEMORY</span>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} opacity={0.2} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-500" />
          </svg>
          <span className="font-mono tabular-nums">{pct}%</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div
          className="flex items-center gap-1 text-xs text-amber-400"
          title={`${pendingCount} pending question${pendingCount === 1 ? "" : "s"} to answer`}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
          </svg>
          <span className="tabular-nums font-medium">{pendingCount}</span>
        </div>
      )}
    </div>
  );
}
