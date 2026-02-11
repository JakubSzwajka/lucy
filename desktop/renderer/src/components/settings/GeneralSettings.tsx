"use client";

import { AVAILABLE_MODELS } from "@/lib/ai/models";
import type { UserSettings, SettingsUpdate, SystemPrompt, AvailableProviders } from "@/types";

interface GeneralSettingsProps {
  settings: UserSettings;
  systemPrompts: SystemPrompt[];
  availableProviders?: AvailableProviders;
  onUpdateSettings: (updates: SettingsUpdate) => Promise<void>;
  onNavigateToPrompts: () => void;
}

export function GeneralSettings({
  settings,
  systemPrompts,
  availableProviders,
  onUpdateSettings,
  onNavigateToPrompts,
}: GeneralSettingsProps) {
  const isModelAvailable = (provider: "openai" | "anthropic" | "google"): boolean => {
    if (!availableProviders) return true;
    return availableProviders[provider];
  };

  const handleModelChange = async (modelId: string) => {
    await onUpdateSettings({ defaultModelId: modelId });
  };

  const handlePromptChange = async (promptId: string) => {
    await onUpdateSettings({
      defaultSystemPromptId: promptId === "" ? null : promptId,
    });
  };

  return (
    <div className="space-y-6">
      {/* Default Model */}
      <div>
        <label className="label-dark block mb-2">Default Model</label>
        <select
          value={settings.defaultModelId || ""}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        >
          {AVAILABLE_MODELS.map((model) => {
            const available = isModelAvailable(model.provider);
            return (
              <option
                key={model.id}
                value={model.id}
                disabled={!available}
                className="bg-background"
              >
                {model.name} ({model.provider}){!available ? " - N/A" : ""}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-muted-dark mt-1">
          This model will be selected by default for new conversations
        </p>
      </div>

      {/* Default System Prompt */}
      <div>
        <label className="label-dark block mb-2">Default System Prompt</label>
        <select
          value={settings.defaultSystemPromptId || ""}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        >
          <option value="" className="bg-background">
            None
          </option>
          {systemPrompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id} className="bg-background">
              {prompt.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-dark mt-1">
          This prompt will be included at the start of every new conversation
        </p>
        <button
          onClick={onNavigateToPrompts}
          className="text-xs text-muted-dark hover:text-foreground mt-2 underline"
        >
          Manage prompts →
        </button>
      </div>
    </div>
  );
}
