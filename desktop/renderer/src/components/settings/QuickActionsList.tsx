"use client";

import type { QuickAction } from "@/types";

interface QuickActionsListProps {
  actions: QuickAction[];
  selectedActionId: string | null;
  onSelectAction: (id: string | null) => void;
  onNewAction: () => void;
}

export function QuickActionsList({
  actions,
  selectedActionId,
  onSelectAction,
  onNewAction,
}: QuickActionsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="label-dark">Quick Actions</span>
        <button
          onClick={onNewAction}
          className="text-xs px-2 py-1 border border-border rounded hover:bg-background-secondary"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-sm text-muted-dark">No quick actions yet</span>
            <p className="text-xs text-muted-darker mt-1">
              Create your first quick action
            </p>
          </div>
        ) : (
          actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onSelectAction(action.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-background-secondary transition-colors ${
                selectedActionId === action.id ? "bg-background-secondary" : ""
              } ${!action.enabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2">
                {action.icon && <span className="text-sm">{action.icon}</span>}
                <span className="text-sm font-medium truncate flex-1">
                  {action.name}
                </span>
                {!action.enabled && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-dark border border-border px-1.5 py-0.5 rounded">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-dark mt-1 truncate">
                {action.content.slice(0, 60)}
                {action.content.length > 60 ? "..." : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
