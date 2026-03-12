import { useCallback, useEffect, useState } from "react";

import { getSessionInfo } from "@/api/client";
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
}

export function SessionBar({ showActivity, onShowActivityChange }: SessionBarProps) {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await getSessionInfo());
    } catch {
      // silently ignore — bar just stays stale
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!info) return null;

  return (
    <div className="flex items-center gap-4 border-b border-border/50 px-4 py-1.5 font-mono text-[11px] text-muted-foreground">
      <span className="truncate max-w-[200px]" title={info.model.id}>
        {info.model.id}
      </span>

      <span title="Total messages">{info.messages.total} msgs</span>
      <span title="Session API cost">{formatCost(info.cost)}</span>

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
