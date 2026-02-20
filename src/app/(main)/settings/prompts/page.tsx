"use client";

import { SystemPromptsSettings } from "@/components/settings/SystemPromptsSettings";
import { useSystemPrompts } from "@/hooks/useSystemPrompts";

export default function PromptsSettingsPage() {
  const {
    prompts,
    isLoading,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = useSystemPrompts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <SystemPromptsSettings
      prompts={prompts}
      onCreatePrompt={createPrompt}
      onUpdatePrompt={updatePrompt}
      onDeletePrompt={deletePrompt}
    />
  );
}
