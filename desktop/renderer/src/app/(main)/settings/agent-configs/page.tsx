"use client";

import { AgentConfigsSettings } from "@/components/settings/AgentConfigsSettings";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import { useSystemPrompts } from "@/hooks/useSystemPrompts";
import { useMcpServers } from "@/hooks/useMcpServers";
import { useSettings } from "@/hooks/useSettings";
import { AVAILABLE_MODELS } from "@/lib/ai/models";

export default function AgentConfigsSettingsPage() {
  const { configs, isLoading, createConfig, updateConfig, deleteConfig } = useAgentConfigs();
  const { prompts } = useSystemPrompts();
  const { servers } = useMcpServers();
  const { settings } = useSettings();

  const enabledModels = AVAILABLE_MODELS.filter(
    (m) => settings?.enabledModels?.includes(m.id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <AgentConfigsSettings
      configs={configs}
      systemPrompts={prompts}
      models={enabledModels}
      mcpServers={servers}
      onCreateConfig={createConfig}
      onUpdateConfig={updateConfig}
      onDeleteConfig={deleteConfig}
    />
  );
}
