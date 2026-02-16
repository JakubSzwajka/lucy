"use client";

import { useState, useEffect } from "react";
import { useMainContext } from "@/app/(main)/layout";
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
  const { models } = useMainContext();
  const [defaultModelId, setDefaultModelId] = useState(settings.defaultModelId || "");
  const [defaultSystemPromptId, setDefaultSystemPromptId] = useState(settings.defaultSystemPromptId || "");
  const [contextWindowSize, setContextWindowSize] = useState(String(settings.contextWindowSize ?? 10));
  const [saving, setSaving] = useState(false);

  // Sync local state when settings prop changes (e.g. after save)
  useEffect(() => {
    setDefaultModelId(settings.defaultModelId || "");
    setDefaultSystemPromptId(settings.defaultSystemPromptId || "");
    setContextWindowSize(String(settings.contextWindowSize ?? 10));
  }, [settings.defaultModelId, settings.defaultSystemPromptId, settings.contextWindowSize]);

  const isDirty =
    defaultModelId !== (settings.defaultModelId || "") ||
    defaultSystemPromptId !== (settings.defaultSystemPromptId || "") ||
    contextWindowSize !== String(settings.contextWindowSize ?? 10);

  const isModelAvailable = (provider: "openai" | "anthropic" | "google"): boolean => {
    if (!availableProviders) return true;
    return availableProviders[provider];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const windowSize = parseInt(contextWindowSize, 10);
      await onUpdateSettings({
        defaultModelId: defaultModelId || null,
        defaultSystemPromptId: defaultSystemPromptId || null,
        contextWindowSize: isNaN(windowSize) ? 10 : Math.max(1, Math.min(100, windowSize)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Default Model */}
      <div>
        <label className="label-dark block mb-2">Default Model</label>
        <select
          value={defaultModelId}
          onChange={(e) => setDefaultModelId(e.target.value)}
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        >
          {models.map((model) => {
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

      {/* Context Window Size */}
      <div>
        <label className="label-dark block mb-2">Context Window Size</label>
        <input
          type="number"
          min={1}
          max={100}
          value={contextWindowSize}
          onChange={(e) => setContextWindowSize(e.target.value)}
          className="w-24 bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        />
        <p className="text-xs text-muted-dark mt-1">
          Number of recent user messages (and all responses between them) sent to the AI. Older messages stay in the database but are not included in the context.
        </p>
      </div>

      {/* Default System Prompt */}
      <div>
        <label className="label-dark block mb-2">Default System Prompt</label>
        <select
          value={defaultSystemPromptId}
          onChange={(e) => setDefaultSystemPromptId(e.target.value)}
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

      {/* Save Button */}
      {isDirty && (
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-foreground text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
