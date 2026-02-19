"use client";

import { useMemo, useState } from "react";
import { useMainContext } from "@/app/(main)/layout";
import type { UserSettings, SettingsUpdate, ModelConfig } from "@/types";

interface ModelsSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (updates: SettingsUpdate) => Promise<void>;
}

function getProviderFromModelId(modelId: string): string {
  const slashIndex = modelId.indexOf("/");
  return slashIndex > 0 ? modelId.substring(0, slashIndex) : "openrouter";
}

function formatProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    meta: "Meta",
    mistral: "Mistral",
    deepseek: "DeepSeek",
    cohere: "Cohere",
    perplexity: "Perplexity",
    xai: "xAI",
  };
  return labels[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ModelsSettings({
  settings,
  onUpdateSettings,
}: ModelsSettingsProps) {
  const { models } = useMainContext();
  const enabledModels = new Set(
    settings.enabledModels.length > 0 ? settings.enabledModels : models.map((m) => m.id)
  );

  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelConfig[]> = {};
    for (const model of models) {
      const provider = getProviderFromModelId(model.id);
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }
    return grouped;
  }, [models]);

  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");

  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  const expandAll = () => {
    setExpandedProviders(new Set(Object.keys(modelsByProvider)));
  };

  const collapseAll = () => {
    setExpandedProviders(new Set());
  };

  const filteredProviders = useMemo(() => {
    if (!filterText.trim()) return Object.entries(modelsByProvider);
    
    const searchLower = filterText.toLowerCase();
    const filtered: [string, ModelConfig[]][] = [];
    
    for (const [provider, providerModels] of Object.entries(modelsByProvider)) {
      const providerMatches = provider.toLowerCase().includes(searchLower) ||
        formatProviderLabel(provider).toLowerCase().includes(searchLower);
      
      const matchingModels = providerModels.filter(model =>
        model.name.toLowerCase().includes(searchLower)
      );
      
      if (providerMatches || matchingModels.length > 0) {
        filtered.push([provider, providerMatches ? providerModels : matchingModels]);
      }
    }
    
    return filtered;
  }, [modelsByProvider, filterText]);

  const handleToggleModel = async (modelId: string) => {
    const newEnabledModels = new Set(enabledModels);
    if (newEnabledModels.has(modelId)) {
      if (newEnabledModels.size === 1) return;
      newEnabledModels.delete(modelId);
    } else {
      newEnabledModels.add(modelId);
    }
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  const handleEnableAll = async (provider: string) => {
    const providerModels = modelsByProvider[provider] || [];
    const newEnabledModels = new Set(enabledModels);
    providerModels.forEach((model) => newEnabledModels.add(model.id));
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  const handleDisableAll = async (provider: string) => {
    const providerModels = modelsByProvider[provider] || [];
    const newEnabledModels = new Set(enabledModels);
    providerModels.forEach((model) => newEnabledModels.delete(model.id));
    if (newEnabledModels.size === 0) return;
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-dark">
        Enable or disable models from appearing in the model selector. At least one model must remain enabled.
      </p>

      <div className="flex gap-4">
        <button
          onClick={expandAll}
          className="text-xs text-muted-dark hover:text-foreground underline"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-muted-dark hover:text-foreground underline"
        >
          Collapse All
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter providers or models..."
          className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground placeholder:text-muted-darker"
        />
        {filterText && (
          <button
            onClick={() => setFilterText("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {filteredProviders.map(([provider, providerModels]) => {
        const isExpanded = expandedProviders.has(provider);
        return (
          <div key={provider} className="border border-border rounded">
            <button
              onClick={() => toggleProvider(provider)}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronIcon expanded={isExpanded} />
                <span className="label">{formatProviderLabel(provider)}</span>
                <span className="text-xs text-muted-dark">
                  ({providerModels.filter(m => enabledModels.has(m.id)).length}/{providerModels.length} enabled)
                </span>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEnableAll(provider)}
                  className="text-xs text-muted-dark hover:text-foreground"
                >
                  Enable All
                </button>
                <span className="text-muted-darker">|</span>
                <button
                  onClick={() => handleDisableAll(provider)}
                  className="text-xs text-muted-dark hover:text-foreground"
                >
                  Disable All
                </button>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {providerModels.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-background-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabledModels.has(model.id)}
                      onChange={() => handleToggleModel(model.id)}
                      className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
                    />
                    <span className="text-sm">{model.name}</span>
                    {model.supportsReasoning && (
                      <span className="text-xs text-muted-dark">(reasoning)</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
