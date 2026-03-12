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

export function SessionBar() {
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
      <span title="Session cost">{formatCost(info.cost)}</span>
    </div>
  );
}
