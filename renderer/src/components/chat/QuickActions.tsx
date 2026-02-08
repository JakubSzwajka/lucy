"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { QuickAction } from "@/types";

interface QuickActionsProps {
  onSelect: (content: string) => void;
}

export function QuickActions({ onSelect }: QuickActionsProps) {
  const [actions, setActions] = useState<QuickAction[]>([]);

  useEffect(() => {
    api.request<QuickAction[]>("/api/quick-actions?enabled=true")
      .then((data) => {
        setActions(
          data.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        );
      })
      .catch((err) => console.error("[QuickActions] Failed to fetch:", err));
  }, []);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 justify-center">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelect(action.content)}
          className="px-3 py-1.5 text-xs border border-border rounded-full hover:bg-background-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.name}
        </button>
      ))}
    </div>
  );
}
