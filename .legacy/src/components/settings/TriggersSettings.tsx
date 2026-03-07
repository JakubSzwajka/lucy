"use client";

import { useState } from "react";
import { TriggersList } from "./TriggersList";
import { TriggerEditor } from "./TriggerEditor";
import type {
  Trigger,
  TriggerCreate,
  TriggerUpdate,
  AgentConfigWithTools,
} from "@/types";

interface TriggersSettingsProps {
  triggers: Trigger[];
  agentConfigs: AgentConfigWithTools[];
  onCreateTrigger: (data: TriggerCreate) => Promise<Trigger>;
  onUpdateTrigger: (id: string, data: TriggerUpdate) => Promise<Trigger>;
  onDeleteTrigger: (id: string) => Promise<void>;
}

export function TriggersSettings({
  triggers,
  agentConfigs,
  onCreateTrigger,
  onUpdateTrigger,
  onDeleteTrigger,
}: TriggersSettingsProps) {
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedTrigger = triggers.find((t) => t.id === selectedTriggerId) || null;

  const handleSelectTrigger = (id: string | null) => {
    setSelectedTriggerId(id);
    setIsCreating(false);
  };

  const handleNewTrigger = () => {
    setSelectedTriggerId(null);
    setIsCreating(true);
  };

  const handleSave = async (data: TriggerCreate | TriggerUpdate) => {
    if (isCreating) {
      const created = await onCreateTrigger(data as TriggerCreate);
      setSelectedTriggerId(created.id);
      setIsCreating(false);
    } else if (selectedTriggerId) {
      await onUpdateTrigger(selectedTriggerId, data as TriggerUpdate);
    }
  };

  const handleDelete = async () => {
    if (selectedTriggerId) {
      await onDeleteTrigger(selectedTriggerId);
      setSelectedTriggerId(null);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setSelectedTriggerId(null);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="w-1/3 border-r border-border bg-background-secondary">
        <TriggersList
          triggers={triggers}
          selectedTriggerId={selectedTriggerId}
          onSelectTrigger={handleSelectTrigger}
          onNewTrigger={handleNewTrigger}
        />
      </div>

      <div className="flex-1 bg-background">
        <TriggerEditor
          trigger={selectedTrigger}
          agentConfigs={agentConfigs}
          isNew={isCreating}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
