"use client";

import { useState, useRef, useEffect } from "react";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import { useMemorySettings, useUpdateMemorySettings } from "@/hooks/useMemorySettings";
import { useModels } from "@/hooks/useModels";
import { cn } from "@/lib/utils";
import type { AgentConfigWithTools } from "@/types";

// ---------------------------------------------------------------------------
// Shared config selector dropdown
// ---------------------------------------------------------------------------

function ConfigSelector({
  configs,
  selectedId,
  onSelect,
  onClose,
  emptyLabel,
}: {
  configs: AgentConfigWithTools[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  emptyLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (configs.length === 0) {
    return (
      <div
        ref={ref}
        className="absolute z-50 mt-1 w-64 bg-background-tertiary border border-border rounded-lg shadow-xl p-3"
      >
        <p className="text-xs text-muted-dark">{emptyLabel ?? "No configs available"}</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-72 bg-background-tertiary border border-border rounded-lg shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="label-dark text-[10px]">SELECT CONFIG</span>
      </div>
      <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
        {configs.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              onSelect(c.id);
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors",
              c.id === selectedId
                ? "bg-background-secondary text-foreground"
                : "hover:bg-background-secondary/50 text-muted-dark hover:text-foreground"
            )}
          >
            <div className="w-7 h-7 rounded-md bg-background flex items-center justify-center text-sm flex-shrink-0">
              {c.icon || c.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{c.name}</div>
              {c.description && (
                <div className="text-[10px] text-muted-darker truncate">{c.description}</div>
              )}
            </div>
            {c.id === selectedId && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TeamComposition() {
  const { configs, updateConfig, refreshConfigs, isLoading: configsLoading } = useAgentConfigs();
  const { data: memorySettings, isLoading: memoryLoading } = useMemorySettings();
  const { getModelConfig } = useModels();
  const updateMemory = useUpdateMemorySettings();

  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [showObserverPicker, setShowObserverPicker] = useState(false);

  const defaultConfig = configs.find((c) => c.isDefault);
  const reflectionConfig = memorySettings?.reflectionAgentConfigId
    ? configs.find((c) => c.id === memorySettings.reflectionAgentConfigId)
    : null;

  const isLoading = configsLoading || memoryLoading;

  const handleToggleAutoReflect = () => {
    if (!memorySettings) return;
    updateMemory.mutate({ autoExtract: !memorySettings.autoExtract });
  };

  const handleChangeLeader = async (configId: string) => {
    await updateConfig(configId, { isDefault: true });
    refreshConfigs();
  };

  const handleChangeObserver = (configId: string) => {
    updateMemory.mutate({ reflectionAgentConfigId: configId });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-dark">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Page header */}
        <div>
          <span className="label-dark text-xs">{"// SYSTEM_ORCHESTRATION"}</span>
          <h1 className="text-lg font-bold mt-1">Team Composition</h1>
        </div>

        {/* COMMAND_HUB */}
        <section className="space-y-3">
          <span className="label-dark text-xs">{"// COMMAND_HUB"}</span>

          {defaultConfig ? (
            <div className="bg-background-secondary border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center text-lg flex-shrink-0">
                  {defaultConfig.icon || "🤖"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-purple-400">ROLE: LEADER</span>
                  <div className="text-lg font-medium truncate">{defaultConfig.name}</div>
                  {defaultConfig.description && (
                    <p className="text-sm text-muted-dark mt-0.5 line-clamp-2">
                      {defaultConfig.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                {/* Core model */}
                <div>
                  <span className="label-dark text-[10px]">CORE_MODEL</span>
                  <div className="font-mono text-sm mt-0.5">
                    {defaultConfig.defaultModelId
                      ? getModelConfig(defaultConfig.defaultModelId)?.name ??
                        defaultConfig.defaultModelId
                      : "—"}
                  </div>
                </div>

                {/* System access */}
                <div>
                  <span className="label-dark text-[10px]">SYSTEM_ACCESS</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {defaultConfig.tools.length === 0 ? (
                      <span className="text-xs text-muted-dark">No tools</span>
                    ) : (
                      Array.from(
                        defaultConfig.tools.reduce((acc, t) => {
                          const label =
                            t.toolType === "mcp"
                              ? t.toolRef
                              : t.toolType === "builtin"
                                ? t.toolRef.toUpperCase()
                                : t.toolName ?? t.toolRef;
                          acc.set(label, t.toolType);
                          return acc;
                        }, new Map<string, string>())
                      ).map(([label, type]) => (
                        <span
                          key={label}
                          className="font-mono text-[10px] px-2 py-0.5 border border-border rounded bg-background"
                          title={`Type: ${type}`}
                        >
                          {label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-1 relative">
                <button
                  onClick={() => setShowLeaderPicker(!showLeaderPicker)}
                  className="text-xs font-mono text-muted-dark hover:text-foreground underline"
                >
                  CHANGE_CONFIG →
                </button>
                {showLeaderPicker && (
                  <ConfigSelector
                    configs={configs}
                    selectedId={defaultConfig.id}
                    onSelect={handleChangeLeader}
                    onClose={() => setShowLeaderPicker(false)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-background-secondary border border-border rounded-lg p-5 space-y-3">
              <p className="text-sm text-muted-dark">No leader configured</p>
              <div className="relative">
                <button
                  onClick={() => setShowLeaderPicker(!showLeaderPicker)}
                  className="text-xs font-mono text-muted-dark hover:text-foreground underline"
                >
                  Select a leader config →
                </button>
                {showLeaderPicker && (
                  <ConfigSelector
                    configs={configs}
                    selectedId={null}
                    onSelect={handleChangeLeader}
                    onClose={() => setShowLeaderPicker(false)}
                    emptyLabel="Create an agent config first in the Agents section"
                  />
                )}
              </div>
            </div>
          )}
        </section>

        {/* PASSIVE_OBSERVER */}
        <section className="space-y-3">
          <span className="label-dark text-xs">{"// PASSIVE_OBSERVER"}</span>

          <div className="bg-background-secondary border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center text-lg flex-shrink-0">
                  {reflectionConfig?.icon || "👁"}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-medium truncate">
                    {reflectionConfig?.name ?? "No observer selected"}
                  </div>
                  <span className="font-mono text-[10px] text-muted-dark">
                    ISOLATED SYSTEM PROCESS
                  </span>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={handleToggleAutoReflect}
                disabled={updateMemory.isPending}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span className="font-mono text-[10px] text-muted-dark">AUTO_REFLECT</span>
                <div
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    memorySettings?.autoExtract
                      ? "bg-green-500/80"
                      : "bg-background border border-border"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-foreground transition-transform ${
                      memorySettings?.autoExtract ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            </div>

            <p className="text-sm text-muted-dark italic">
              Automatically reflects on conversations to extract memories and insights after a
              token threshold is reached.
            </p>

            <div className="pt-1 relative">
              <button
                onClick={() => setShowObserverPicker(!showObserverPicker)}
                className="text-xs font-mono text-muted-dark hover:text-foreground underline"
              >
                {reflectionConfig ? "CHANGE_OBSERVER →" : "SELECT_OBSERVER →"}
              </button>
              {showObserverPicker && (
                <ConfigSelector
                  configs={configs}
                  selectedId={memorySettings?.reflectionAgentConfigId ?? null}
                  onSelect={handleChangeObserver}
                  onClose={() => setShowObserverPicker(false)}
                  emptyLabel="Create an agent config first"
                />
              )}
            </div>
          </div>
        </section>

        {/* ALL CONFIGS */}
        {(() => {
          const assignedIds = new Set<string>();
          if (defaultConfig) assignedIds.add(defaultConfig.id);
          if (reflectionConfig) assignedIds.add(reflectionConfig.id);
          const others = configs.filter((c) => !assignedIds.has(c.id));

          return (
            <section className="space-y-3">
              <span className="label-dark text-xs">{"// AGENT_CONFIGS"}</span>

              {others.length === 0 ? (
                <p className="text-xs text-muted-dark">No other configs</p>
              ) : (
                <div className="space-y-2">
                  {others.map((c) => (
                    <div
                      key={c.id}
                      className="bg-background-secondary border border-border rounded-lg px-4 py-3 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center text-base flex-shrink-0">
                        {c.icon || c.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        {c.description && (
                          <div className="text-xs text-muted-dark truncate">{c.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {c.defaultModelId && (
                          <span className="font-mono text-[10px] text-muted-dark">
                            {getModelConfig(c.defaultModelId)?.name ?? c.defaultModelId}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-darker">
                          {c.tools.length} tool{c.tools.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}
      </div>
    </div>
  );
}
