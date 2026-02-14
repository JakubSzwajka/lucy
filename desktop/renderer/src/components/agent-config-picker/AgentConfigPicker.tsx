"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AgentConfigWithTools } from "@/types";

interface AgentConfigPickerProps {
  configs: AgentConfigWithTools[];
  onSelect: (configId: string) => void;
  onClose: () => void;
}

export function AgentConfigPicker({ configs, onSelect, onClose }: AgentConfigPickerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-background-tertiary border border-border rounded-lg shadow-xl w-[400px] max-h-[500px] flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="label text-muted">{"// SELECT_AGENT"}</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-background transition-colors text-muted-dark hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
          {configs.map((config) => (
            <button
              key={config.id}
              onClick={() => onSelect(config.id)}
              className={cn(
                "flex flex-col items-start gap-1.5 p-3 rounded-md border transition-colors text-left",
                config.isDefault
                  ? "border-foreground/30 bg-background-secondary/20 hover:bg-background-secondary/40"
                  : "border-border hover:border-foreground/20 hover:bg-background-secondary/30"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: config.color ? `${config.color}20` : undefined }}
                >
                  {config.icon || config.name[0].toUpperCase()}
                </div>
                {config.isDefault && (
                  <span className="ml-auto text-[9px] mono uppercase text-muted-dark bg-background px-1.5 py-0.5 rounded">
                    default
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-foreground truncate w-full">{config.name}</span>
              {config.description && (
                <span className="text-[10px] text-muted-dark line-clamp-2">{config.description}</span>
              )}
              <span className="text-[10px] text-muted-darker">
                {config.tools.length} tool{config.tools.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
