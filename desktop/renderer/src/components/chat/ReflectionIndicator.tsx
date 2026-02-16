"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useMemorySettings } from "@/hooks/useMemorySettings";
import type { Session } from "@/types";

interface ReflectionIndicatorProps {
  sessionId: string | null;
  /** Pass chat status so we refetch after each stream completes. */
  chatStatus?: string;
}

export function ReflectionIndicator({ sessionId, chatStatus }: ReflectionIndicatorProps) {
  const { data: settings } = useMemorySettings();

  // Fetch current session individually; refetchKey changes after each stream.
  const { data: session } = useQuery({
    queryKey: ["session-reflection", sessionId, chatStatus],
    queryFn: async () => {
      const data = await api.request<Record<string, unknown>>(`/api/sessions/${sessionId}`);
      return data as unknown as Session;
    },
    enabled: !!sessionId && !!settings?.autoExtract,
    staleTime: 10_000,
  });

  if (!settings?.autoExtract || !session) return null;

  const current = session.reflectionTokenCount ?? 0;
  const threshold = settings.reflectionTokenThreshold;
  const progress = Math.min(current / threshold, 1);
  const pct = Math.round(progress * 100);

  // SVG ring dimensions
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-dark"
      title={`Auto-reflection: ${current.toLocaleString()} / ${threshold.toLocaleString()} tokens (${pct}%)`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity={0.2}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}
