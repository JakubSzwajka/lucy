"use client";

import type { AgentConfigWithTools } from "@/types";

interface AgentConfigsListProps {
  configs: AgentConfigWithTools[];
  selectedConfigId: string | null;
  onSelectConfig: (id: string | null) => void;
  onNewConfig: () => void;
}

export function AgentConfigsList({
  configs,
  selectedConfigId,
  onSelectConfig,
  onNewConfig,
}: AgentConfigsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <span className="label-dark">Agent Configs</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {configs.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-sm text-muted-dark">No agent configs yet</span>
            <p className="text-xs text-muted-darker mt-1">
              Create your first agent configuration
            </p>
          </div>
        ) : (
          configs.map((config) => (
            <button
              key={config.id}
              onClick={() => onSelectConfig(config.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-background-secondary transition-colors ${
                selectedConfigId === config.id ? "bg-background-secondary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {config.icon && <span className="text-sm">{config.icon}</span>}
                <span className="text-sm font-medium truncate flex-1">
                  {config.name}
                </span>
                {config.isDefault && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-dark border border-border px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              {config.description && (
                <p className="text-xs text-muted-dark mt-1 truncate">
                  {config.description.slice(0, 60)}
                  {config.description.length > 60 ? "..." : ""}
                </p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onNewConfig}
          className="w-full text-xs px-2 py-1.5 border border-border rounded hover:bg-background-secondary"
        >
          + New
        </button>
      </div>
    </div>
  );
}
