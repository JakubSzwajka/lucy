"use client";

import { SystemPromptsSettings } from "@/components/settings/SystemPromptsSettings";
import { useSettings } from "@/hooks/useSettings";
import { useSystemPrompts } from "@/hooks/useSystemPrompts";

export default function PromptsSettingsPage() {
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings();
  const {
    prompts,
    isLoading: promptsLoading,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = useSystemPrompts();

  const isLoading = settingsLoading || promptsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Failed to load settings</span>
      </div>
    );
  }

  return (
    <SystemPromptsSettings
      prompts={prompts}
      defaultPromptId={settings.defaultSystemPromptId}
      onCreatePrompt={createPrompt}
      onUpdatePrompt={updatePrompt}
      onDeletePrompt={deletePrompt}
      onUpdateSettings={updateSettings}
    />
  );
}
