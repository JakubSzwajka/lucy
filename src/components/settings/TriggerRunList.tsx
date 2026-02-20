"use client";

import { useRouter } from "next/navigation";
import { useMainContext } from "@/app/(main)/layout";
import type { TriggerRun } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  completed: "text-green-500 bg-green-500/10",
  failed: "text-red-500 bg-red-500/10",
  running: "text-blue-500 bg-blue-500/10",
  pending: "text-yellow-500 bg-yellow-500/10",
  skipped: "text-muted-dark bg-background-secondary",
};

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface TriggerRunListProps {
  runs: TriggerRun[];
  triggerId?: string;
  triggerNameMap?: Map<string, string>;
  showTriggerName?: boolean;
  onCancelRun?: (runId: string) => void;
}

export function TriggerRunList({
  runs,
  triggerId,
  triggerNameMap,
  showTriggerName = false,
  onCancelRun,
}: TriggerRunListProps) {
  const router = useRouter();
  const { setActiveSessionId } = useMainContext();

  const navigateToSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    router.push("/");
  };

  if (runs.length === 0) return null;

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto">
      {runs.map((run) => {
        const isClickable = !!run.sessionId;
        const isActive = run.status === "running" || run.status === "pending";

        return (
          <div
            key={run.id}
            onClick={isClickable ? () => navigateToSession(run.sessionId!) : undefined}
            className={`flex items-center gap-2 text-xs py-1.5 px-1 rounded border-b border-border last:border-0 ${
              isClickable
                ? "cursor-pointer hover:bg-background-secondary transition-colors"
                : ""
            }`}
          >
            <span
              className={`font-mono px-1.5 py-0.5 rounded w-[68px] text-center flex-shrink-0 ${
                STATUS_STYLES[run.status] ?? "text-muted-dark bg-background-secondary"
              }`}
            >
              {run.status}
            </span>

            {isActive && onCancelRun && triggerId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelRun(run.id);
                }}
                className="px-1.5 py-0.5 text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white font-mono flex-shrink-0"
              >
                stop
              </button>
            )}

            <span className="text-muted-dark font-mono w-16 flex-shrink-0">
              {run.startedAt ? formatTimeAgo(new Date(run.startedAt)) : "—"}
            </span>

            {showTriggerName && triggerNameMap && (
              <span className="text-foreground truncate w-32 flex-shrink-0">
                {triggerNameMap.get(run.triggerId) ?? "—"}
              </span>
            )}

            {run.error ? (
              <span className="text-red-500 truncate flex-1">{run.error}</span>
            ) : run.result ? (
              <span className="text-muted-dark truncate flex-1">{run.result}</span>
            ) : run.skipReason ? (
              <span className="text-muted-dark truncate flex-1">{run.skipReason}</span>
            ) : (
              <span className="flex-1" />
            )}

            {isClickable && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-muted-dark flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
