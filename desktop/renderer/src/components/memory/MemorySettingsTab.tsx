"use client";

import { useMemorySettings, useUpdateMemorySettings } from "@/hooks/useMemorySettings";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";

export function MemorySettingsTab() {
  const { data: settings, isLoading } = useMemorySettings();
  const updateMutation = useUpdateMemorySettings();
  const { configs, isLoading: configsLoading } = useAgentConfigs();

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-dark">
        Loading settings...
      </div>
    );
  }

  const handleBool = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleNumber = (key: string, value: number) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleString = (key: string, value: string) => {
    updateMutation.mutate({ [key]: value || null });
  };

  return (
    <div className="p-6 space-y-6 max-w-xl">
      {/* Auto-reflection section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Auto-reflection</h3>

        <div className="flex items-center justify-between">
          <div>
            <label className="label-dark block">Automatic memory extraction</label>
            <p className="text-xs text-muted-dark mt-0.5">
              Automatically extract memories during conversations based on token count
            </p>
          </div>
          <button
            onClick={() => handleBool("autoExtract", !settings.autoExtract)}
            disabled={updateMutation.isPending}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
              settings.autoExtract ? "bg-foreground" : "bg-border"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform mt-0.5 ${
                settings.autoExtract ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {settings.autoExtract && (
          <>
            <div>
              <label className="label-dark block mb-2">
                Token threshold: {settings.reflectionTokenThreshold.toLocaleString()}
              </label>
              <input
                type="range"
                min="1000"
                max="20000"
                step="1000"
                value={settings.reflectionTokenThreshold}
                onChange={(e) => handleNumber("reflectionTokenThreshold", parseInt(e.target.value))}
                className="w-full accent-foreground"
                disabled={updateMutation.isPending}
              />
              <p className="text-xs text-muted-dark mt-1">
                Tokens of new conversation before triggering a reflection
              </p>
            </div>

            <div>
              <label className="label-dark block mb-2">Reflection agent</label>
              {configsLoading ? (
                <p className="text-xs text-muted-dark">Loading agent configs...</p>
              ) : configs.length === 0 ? (
                <p className="text-xs text-muted-dark">
                  Create an agent config first to enable automatic reflection
                </p>
              ) : (
                <select
                  value={settings.reflectionAgentConfigId ?? ""}
                  onChange={(e) =>
                    updateMutation.mutate({ reflectionAgentConfigId: e.target.value || null })
                  }
                  className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
                  disabled={updateMutation.isPending}
                >
                  <option value="" className="bg-background">
                    None
                  </option>
                  {configs.map((config) => (
                    <option key={config.id} value={config.id} className="bg-background">
                      {config.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-dark mt-1">
                Select an agent config to use for automatic memory reflection
              </p>
            </div>
          </>
        )}
      </div>

      <hr className="border-border" />

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

      {updateMutation.isError && (
        <p className="text-xs text-red-500">
          Failed to save settings. Please try again.
        </p>
      )}
    </div>
  );
}
