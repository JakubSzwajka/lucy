"use client";

import { useMemo } from "react";
import { useMainContext } from "@/app/(main)/layout";
import type { UserSettings, SettingsUpdate } from "@/types";

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

      {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
        <div key={provider} className="border border-border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="label">{formatProviderLabel(provider)}</span>
            </div>
            <div className="flex gap-2">
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
          </div>

          <div className="space-y-2">
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
        </div>
      ))}
    </div>
  );
}
