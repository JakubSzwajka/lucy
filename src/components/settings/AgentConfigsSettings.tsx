"use client";

import { useState } from "react";
import { AgentConfigsList } from "./AgentConfigsList";
import { AgentConfigEditor } from "./AgentConfigEditor";
import type {
  AgentConfigWithTools,
  AgentConfigCreate,
  AgentConfigUpdate,
  SystemPrompt,
  ModelConfig,
  McpServer,
} from "@/types";

interface AgentConfigsSettingsProps {
  configs: AgentConfigWithTools[];
  systemPrompts: SystemPrompt[];
  models: ModelConfig[];
  mcpServers: McpServer[];
  onCreateConfig: (data: AgentConfigCreate) => Promise<AgentConfigWithTools>;
  onUpdateConfig: (id: string, data: AgentConfigUpdate) => Promise<AgentConfigWithTools>;
  onDeleteConfig: (id: string) => Promise<void>;
}

export function AgentConfigsSettings({
  configs,
  systemPrompts,
  models,
  mcpServers,
  onCreateConfig,
  onUpdateConfig,
  onDeleteConfig,
}: AgentConfigsSettingsProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedConfig = configs.find((c) => c.id === selectedConfigId) || null;

  const handleSelectConfig = (id: string | null) => {
    setSelectedConfigId(id);
    setIsCreating(false);
  };

  const handleNewConfig = () => {
    setSelectedConfigId(null);
    setIsCreating(true);
  };

  const handleSave = async (data: AgentConfigCreate | AgentConfigUpdate) => {
    if (isCreating) {
      const created = await onCreateConfig(data as AgentConfigCreate);
      setSelectedConfigId(created.id);
      setIsCreating(false);
    } else if (selectedConfigId) {
      await onUpdateConfig(selectedConfigId, data as AgentConfigUpdate);
    }
  };

  const handleDelete = async () => {
    if (selectedConfigId) {
      await onDeleteConfig(selectedConfigId);
      setSelectedConfigId(null);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setSelectedConfigId(null);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="w-1/3 border-r border-border bg-background-secondary">
        <AgentConfigsList
          configs={configs}
          selectedConfigId={selectedConfigId}
          onSelectConfig={handleSelectConfig}
          onNewConfig={handleNewConfig}
        />
      </div>

      <div className="flex-1 bg-background">
        <AgentConfigEditor
          config={selectedConfig}
          configs={configs}
          systemPrompts={systemPrompts}
          models={models}
          mcpServers={mcpServers}
          isNew={isCreating}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
