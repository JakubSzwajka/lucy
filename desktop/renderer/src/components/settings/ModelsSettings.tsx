"use client";

import { useMainContext } from "@/app/(main)/layout";
import type { UserSettings, SettingsUpdate, AvailableProviders, ModelConfig } from "@/types";

interface ModelsSettingsProps {
  settings: UserSettings;
  availableProviders?: AvailableProviders;
  onUpdateSettings: (updates: SettingsUpdate) => Promise<void>;
}

type Provider = "openai" | "anthropic" | "google";

const PROVIDER_NAMES: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function ModelsSettings({
  settings,
  availableProviders,
  onUpdateSettings,
}: ModelsSettingsProps) {
  const { models } = useMainContext();
  const enabledModels = new Set(settings.enabledModels);

  const isProviderAvailable = (provider: Provider): boolean => {
    if (!availableProviders) return true;
    return availableProviders[provider];
  };

  const modelsByProvider = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<Provider, ModelConfig[]>
  );

  const handleToggleModel = async (modelId: string) => {
    const newEnabledModels = new Set(enabledModels);
    if (newEnabledModels.has(modelId)) {
      // Don't allow disabling if it's the last enabled model
      if (newEnabledModels.size === 1) {
        return;
      }
      newEnabledModels.delete(modelId);
    } else {
      newEnabledModels.add(modelId);
    }
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  const handleEnableAll = async (provider: Provider) => {
    const providerModels = modelsByProvider[provider] || [];
    const newEnabledModels = new Set(enabledModels);
    providerModels.forEach((model) => newEnabledModels.add(model.id));
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  const handleDisableAll = async (provider: Provider) => {
    const providerModels = modelsByProvider[provider] || [];
    const newEnabledModels = new Set(enabledModels);
    providerModels.forEach((model) => newEnabledModels.delete(model.id));
    // Ensure at least one model remains enabled
    if (newEnabledModels.size === 0) {
      return;
    }
    await onUpdateSettings({ enabledModels: Array.from(newEnabledModels) });
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-dark">
        Enable or disable models from appearing in the model selector. At least one model must remain enabled.
      </p>

      {(Object.keys(PROVIDER_NAMES) as Provider[]).map((provider) => {
        const models = modelsByProvider[provider] || [];
        const providerAvailable = isProviderAvailable(provider);

        return (
          <div key={provider} className="border border-border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="label">{PROVIDER_NAMES[provider]}</span>
                {!providerAvailable && (
                  <span className="text-xs text-muted-dark">(No API Key)</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEnableAll(provider)}
                  disabled={!providerAvailable}
                  className="text-xs text-muted-dark hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enable All
                </button>
                <span className="text-muted-darker">|</span>
                <button
                  onClick={() => handleDisableAll(provider)}
                  disabled={!providerAvailable}
                  className="text-xs text-muted-dark hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disable All
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {models.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-2 rounded hover:bg-background-secondary cursor-pointer ${
                    !providerAvailable ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabledModels.has(model.id)}
                    onChange={() => handleToggleModel(model.id)}
                    disabled={!providerAvailable}
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
        );
      })}
    </div>
  );
}
