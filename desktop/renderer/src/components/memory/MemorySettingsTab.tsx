"use client";

import { useMemorySettings, useUpdateMemorySettings } from "@/hooks/useMemorySettings";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import { useMainContext } from "@/app/(main)/layout";

export function MemorySettingsTab() {
  const { data: settings, isLoading } = useMemorySettings();
  const updateMutation = useUpdateMemorySettings();
  const { availableProviders } = useMainContext();

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-dark">
        Loading settings...
      </div>
    );
  }

  const handleNumber = (key: string, value: number) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleString = (key: string, value: string) => {
    updateMutation.mutate({ [key]: value || null });
  };

  return (
    <div className="p-6 space-y-6 max-w-xl">
      {/* Default scope */}
      <div>
        <label className="label-dark block mb-2">Default scope</label>
        <input
          type="text"
          value={settings.defaultScope}
          onChange={(e) => handleString("defaultScope", e.target.value)}
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
          placeholder="global"
          disabled={updateMutation.isPending}
        />
        <p className="text-xs text-muted-dark mt-1">
          Default scope tag for new memories (e.g. &quot;global&quot;, &quot;project:lucy&quot;)
        </p>
      </div>

      {/* Max context memories */}
      <div>
        <label className="label-dark block mb-2">
          Max context memories: {settings.maxContextMemories}
        </label>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={settings.maxContextMemories}
          onChange={(e) => handleNumber("maxContextMemories", parseInt(e.target.value))}
          className="w-full accent-foreground"
          disabled={updateMutation.isPending}
        />
        <p className="text-xs text-muted-dark mt-1">
          Maximum number of memories injected into the chat system prompt
        </p>
      </div>

      {/* Questions per session */}
      <div>
        <label className="label-dark block mb-2">
          Questions per session: {settings.questionsPerSession}
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={settings.questionsPerSession}
          onChange={(e) => handleNumber("questionsPerSession", parseInt(e.target.value))}
          className="w-full accent-foreground"
          disabled={updateMutation.isPending}
        />
        <p className="text-xs text-muted-dark mt-1">
          Number of curiosity questions surfaced at session start. Set to 0 to disable.
        </p>
      </div>

      {/* Extraction model */}
      <div>
        <label className="label-dark block mb-2">Extraction model</label>
        <select
          value={settings.extractionModel ?? ""}
          onChange={(e) => handleString("extractionModel", e.target.value)}
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
          disabled={updateMutation.isPending}
        >
          <option value="" className="bg-background">
            Default (GPT-4o Mini)
          </option>
          {AVAILABLE_MODELS.map((model) => {
            const isAvailable = !availableProviders || availableProviders[model.provider];
            const value = `${model.provider}/${model.modelId}`;
            return (
              <option
                key={model.id}
                value={value}
                disabled={!isAvailable}
                className="bg-background"
              >
                {model.name} ({model.provider}){!isAvailable ? " - N/A" : ""}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-muted-dark mt-1">
          Model used for memory extraction. Cheaper models recommended for cost efficiency.
        </p>
      </div>

      {updateMutation.isError && (
        <p className="text-xs text-red-500">
          Failed to save settings. Please try again.
        </p>
      )}
    </div>
  );
}
