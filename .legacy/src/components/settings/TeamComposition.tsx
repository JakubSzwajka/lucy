"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import { useMemorySettings, useUpdateMemorySettings } from "@/hooks/useMemorySettings";
import { useModels } from "@/hooks/useModels";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/client/utils";
import type { AgentConfigWithTools } from "@/types";

// ---------------------------------------------------------------------------
// ConfigSelector — shared dropdown for picking an agent config
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
// AgentConfigCard — unified card for displaying any agent config
// ---------------------------------------------------------------------------

function AgentConfigCard({
  config,
  roleLabel,
  roleColor,
  subtitle,
  fallbackIcon,
  allConfigs,
  onChangeConfig,
  changeLabel,
  emptyLabel,
  getModelName,
  settingsPane,
}: {
  config: AgentConfigWithTools | null;
  roleLabel: string;
  roleColor?: string;
  subtitle?: string;
  fallbackIcon: string;
  allConfigs: AgentConfigWithTools[];
  onChangeConfig: (id: string) => void;
  changeLabel: string;
  emptyLabel: string;
  getModelName: (id: string) => string;
  settingsPane?: ReactNode;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      {/* Settings pane — unique per role */}
      {settingsPane && (
        <div className="px-5 py-3 border-b border-border bg-background-secondary/50">
          {settingsPane}
        </div>
      )}

      {/* Unified config display */}
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center text-lg flex-shrink-0">
            {config?.icon || fallbackIcon}
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn("font-mono text-xs", roleColor ?? "text-muted-dark")}>
              {roleLabel}
            </span>
            <div className="text-lg font-medium truncate">
              {config?.name ?? emptyLabel}
            </div>
            {subtitle && (
              <span className="font-mono text-[10px] text-muted-dark">{subtitle}</span>
            )}
            {config?.description && (
              <p className="text-sm text-muted-dark mt-0.5 line-clamp-2">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {config && (
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="label-dark text-[10px]">CORE_MODEL</span>
              <div className="font-mono text-sm mt-0.5">
                {config.defaultModelId ? getModelName(config.defaultModelId) : "—"}
              </div>
            </div>
            <div>
              <span className="label-dark text-[10px]">SYSTEM_ACCESS</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {config.tools.length === 0 ? (
                  <span className="text-xs text-muted-dark">No tools</span>
                ) : (
                  Array.from(
                    config.tools.reduce((acc, t) => {
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
        )}

        {changeLabel && (
          <div className="pt-1 relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-xs font-mono text-muted-dark hover:text-foreground underline"
            >
              {changeLabel}
            </button>
            {showPicker && (
              <ConfigSelector
                configs={allConfigs}
                selectedId={config?.id ?? null}
                onSelect={onChangeConfig}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle — tiny reusable toggle switch
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button onClick={onChange} disabled={disabled} className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-muted-dark">{label}</span>
      <div
        className={cn(
          "w-8 h-4 rounded-full transition-colors relative",
          checked ? "bg-green-500/80" : "bg-background border border-border"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 w-3 h-3 rounded-full bg-foreground transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TeamComposition() {
  const { configs, updateConfig, refreshConfigs, isLoading: configsLoading } = useAgentConfigs();
  const { data: memorySettings, isLoading: memoryLoading } = useMemorySettings();
  const { getModelConfig } = useModels();
  const { settings, updateSettings } = useSettings();
  const updateMemory = useUpdateMemorySettings();

  const defaultConfig = configs.find((c) => c.isDefault) ?? null;
  const reflectionConfig = memorySettings?.reflectionAgentConfigId
    ? configs.find((c) => c.id === memorySettings.reflectionAgentConfigId) ?? null
    : null;

  const isLoading = configsLoading || memoryLoading;

  const getModelName = (id: string) => getModelConfig(id)?.name ?? id;

  const handleChangeLeader = async (configId: string) => {
    await updateConfig(configId, { isDefault: true });
    refreshConfigs();
  };

  const handleChangeObserver = (configId: string) => {
    updateMemory.mutate({ reflectionAgentConfigId: configId });
  };

  const handleToggleAutoReflect = () => {
    if (!memorySettings) return;
    updateMemory.mutate({ autoExtract: !memorySettings.autoExtract });
  };

  const handleContextWindowChange = (value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 1 && n <= 100) {
      updateSettings({ contextWindowSize: n });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-dark">
        Loading...
      </div>
    );
  }

  // Derive "other" configs
  const assignedIds = new Set<string>();
  if (defaultConfig) assignedIds.add(defaultConfig.id);
  if (reflectionConfig) assignedIds.add(reflectionConfig.id);
  const otherConfigs = configs.filter((c) => !assignedIds.has(c.id));

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
          <AgentConfigCard
            config={defaultConfig}
            roleLabel="ROLE: LEADER"
            roleColor="text-purple-400"
            fallbackIcon="🤖"
            allConfigs={configs}
            onChangeConfig={handleChangeLeader}
            changeLabel={defaultConfig ? "CHANGE_CONFIG →" : "SELECT_LEADER →"}
            emptyLabel="No leader configured"
            getModelName={getModelName}
            settingsPane={
              settings && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-dark text-[10px]">CONTEXT_WINDOW</span>
                    <p className="text-[10px] text-muted-darker mt-0.5">
                      Recent messages included in context
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settings.contextWindowSize}
                      onChange={(e) => handleContextWindowChange(e.target.value)}
                      className="w-16 bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground text-center focus:outline-none focus:border-muted-darker"
                    />
                    <span className="font-mono text-[10px] text-muted-darker">msgs</span>
                  </div>
                </div>
              )
            }
          />
        </section>

        {/* PASSIVE_OBSERVER */}
        <section className="space-y-3">
          <span className="label-dark text-xs">{"// PASSIVE_OBSERVER"}</span>
          <AgentConfigCard
            config={reflectionConfig}
            roleLabel="ROLE: OBSERVER"
            roleColor="text-cyan-400"
            subtitle="ISOLATED SYSTEM PROCESS"
            fallbackIcon="👁"
            allConfigs={configs}
            onChangeConfig={handleChangeObserver}
            changeLabel={reflectionConfig ? "CHANGE_OBSERVER →" : "SELECT_OBSERVER →"}
            emptyLabel="No observer selected"
            getModelName={getModelName}
            settingsPane={
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-dark text-[10px]">AUTO_REFLECT</span>
                    <p className="text-[10px] text-muted-darker mt-0.5">
                      Extract memories after token threshold
                    </p>
                  </div>
                  <Toggle
                    checked={memorySettings?.autoExtract ?? false}
                    disabled={updateMemory.isPending}
                    onChange={handleToggleAutoReflect}
                    label={memorySettings?.autoExtract ? "ON" : "OFF"}
                  />
                </div>
                {memorySettings?.autoExtract && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="label-dark text-[10px]">TOKEN_THRESHOLD</span>
                      <p className="text-[10px] text-muted-darker mt-0.5">
                        Min tokens before triggering reflection
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1000}
                        max={20000}
                        step={1000}
                        value={memorySettings.reflectionTokenThreshold}
                        onChange={(e) =>
                          updateMemory.mutate({
                            reflectionTokenThreshold: parseInt(e.target.value),
                          })
                        }
                        className="w-28 accent-foreground"
                      />
                      <span className="font-mono text-[10px] text-muted-dark w-12 text-right">
                        {(memorySettings.reflectionTokenThreshold / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </section>

        {/* SUB-AGENTS */}
        {otherConfigs.length > 0 && (
          <section className="space-y-3">
            <span className="label-dark text-xs">{"// SUB_AGENTS"}</span>
            {otherConfigs.map((c) => (
              <AgentConfigCard
                key={c.id}
                config={c}
                roleLabel="ROLE: SUB-AGENT"
                roleColor="text-orange-400"
                fallbackIcon="⚡"
                allConfigs={configs}
                onChangeConfig={async (_id) => {
                  // No-op: sub-agents don't swap configs, they are the config
                }}
                changeLabel=""
                emptyLabel=""
                getModelName={getModelName}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
