import { useCallback, useEffect, useState } from "react";

import { getSessionInfo, newSession } from "@/api/client";
import type { SessionInfo } from "@/api/types";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

interface SessionBarProps {
  showActivity: boolean;
  onShowActivityChange: (value: boolean) => void;
  streaming: boolean;
  onNewSession: () => void;
}

export function SessionBar({ showActivity, onShowActivityChange, streaming, onNewSession }: SessionBarProps) {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await getSessionInfo());
    } catch {
      // silently ignore — bar just stays stale
    }
  }, []);

  const handleNewSession = useCallback(async () => {
    try {
      await newSession();
      onNewSession();
      refresh();
    } catch (err) {
      console.error("[session] failed to create new session:", err);
    }
  }, [onNewSession, refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!info) return null;

  return (
    <div className="flex items-center gap-4 border-b border-border/50 px-4 py-1.5 font-mono text-[11px] text-muted-foreground">
      <button
        onClick={handleNewSession}
        disabled={streaming}
        className="px-3 py-0.5 rounded bg-primary text-primary-foreground font-semibold text-xs hover:opacity-85 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="New session"
      >
        New Session
      </button>
      <span className="truncate max-w-[200px]" title={info.model.id}>
        {info.model.id}
      </span>

      <span title="Total messages">{info.messages.total} msgs</span>
      <span title="Session API cost">{formatCost(info.cost)}</span>

      {info.context.tokens !== null && info.compaction.threshold > 0 && (() => {
        const ratio = info.context.tokens / info.compaction.threshold;
        return (
          <span className="flex items-center gap-1.5" title={`Context: ${formatTokens(info.context.tokens)} / ${formatTokens(info.compaction.threshold)} tokens (compaction at 100%)`}>
            <span className="text-muted-foreground/70">{formatTokens(info.context.tokens)}</span>
            <span className="relative h-1.5 w-20 rounded-full bg-border/60 overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(ratio * 100, 100)}%`,
                  backgroundColor: ratio > 0.85
                    ? 'hsl(0, 70%, 55%)'
                    : ratio > 0.6
                      ? 'hsl(40, 80%, 55%)'
                      : 'hsl(var(--primary))',
                }}
              />
            </span>
            <span className="text-muted-foreground/70">{formatTokens(info.compaction.threshold)}</span>
            {info.compaction.isCompacting && (
              <span className="text-[10px] text-yellow-500 animate-pulse">compacting…</span>
            )}
          </span>
        );
      })()}

      <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showActivity}
          onChange={(e) => onShowActivityChange(e.target.checked)}
          className="h-3 w-3 rounded border-border accent-primary cursor-pointer"
        />
        Activity
      </label>
    </div>
  );
}
