"use client";

import type { Trigger } from "@/types";

interface TriggersListProps {
  triggers: Trigger[];
  selectedTriggerId: string | null;
  onSelectTrigger: (id: string | null) => void;
  onNewTrigger: () => void;
}

export function TriggersList({
  triggers,
  selectedTriggerId,
  onSelectTrigger,
  onNewTrigger,
}: TriggersListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <span className="label-dark">Triggers</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {triggers.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-sm text-muted-dark">No triggers yet</span>
            <p className="text-xs text-muted-darker mt-1">
              Create your first trigger to automate agent runs
            </p>
          </div>
        ) : (
          triggers.map((trigger) => (
            <button
              key={trigger.id}
              onClick={() => onSelectTrigger(trigger.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-background-secondary transition-colors ${
                selectedTriggerId === trigger.id ? "bg-background-secondary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate flex-1">
                  {trigger.name}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-dark border border-border px-1.5 py-0.5 rounded font-mono">
                  {trigger.triggerType}
                </span>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    trigger.enabled ? "bg-green-500" : "bg-neutral-500"
                  }`}
                />
              </div>
              {trigger.description && (
                <p className="text-xs text-muted-dark mt-1 truncate">
                  {trigger.description.slice(0, 60)}
                  {trigger.description.length > 60 ? "..." : ""}
                </p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onNewTrigger}
          className="w-full text-xs px-2 py-1.5 border border-border rounded hover:bg-background-secondary"
        >
          + New
        </button>
      </div>
    </div>
  );
}
