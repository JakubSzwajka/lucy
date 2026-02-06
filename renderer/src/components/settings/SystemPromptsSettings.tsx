"use client";

import { useState } from "react";
import { PromptsList } from "./PromptsList";
import { PromptEditor } from "./PromptEditor";
import type {
  SystemPrompt,
  SystemPromptCreate,
  SystemPromptUpdate,
  SettingsUpdate,
} from "@/types";

interface SystemPromptsSettingsProps {
  prompts: SystemPrompt[];
  defaultPromptId: string | null;
  onCreatePrompt: (data: SystemPromptCreate) => Promise<SystemPrompt>;
  onUpdatePrompt: (id: string, data: SystemPromptUpdate) => Promise<SystemPrompt>;
  onDeletePrompt: (id: string) => Promise<void>;
  onUpdateSettings: (updates: SettingsUpdate) => Promise<void>;
}

export function SystemPromptsSettings({
  prompts,
  defaultPromptId,
  onCreatePrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onUpdateSettings,
}: SystemPromptsSettingsProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId) || null;

  const handleSelectPrompt = (id: string | null) => {
    setSelectedPromptId(id);
    setIsCreating(false);
  };

  const handleNewPrompt = () => {
    setSelectedPromptId(null);
    setIsCreating(true);
  };

  const handleSave = async (data: SystemPromptCreate | SystemPromptUpdate) => {
    if (isCreating) {
      const created = await onCreatePrompt(data as SystemPromptCreate);
      setSelectedPromptId(created.id);
      setIsCreating(false);
    } else if (selectedPromptId) {
      await onUpdatePrompt(selectedPromptId, data as SystemPromptUpdate);
    }
  };

  const handleDelete = async () => {
    if (selectedPromptId) {
      await onDeletePrompt(selectedPromptId);
      setSelectedPromptId(null);
    }
  };

  const handleSetDefault = async () => {
    if (selectedPromptId) {
      await onUpdateSettings({ defaultSystemPromptId: selectedPromptId });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setSelectedPromptId(null);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left panel: List */}
      <div className="w-1/3 border-r border-border bg-background-secondary">
        <PromptsList
          prompts={prompts}
          selectedPromptId={selectedPromptId}
          defaultPromptId={defaultPromptId}
          onSelectPrompt={handleSelectPrompt}
          onNewPrompt={handleNewPrompt}
        />
      </div>

      {/* Right panel: Editor */}
      <div className="flex-1 bg-background">
        <PromptEditor
          prompt={selectedPrompt}
          isNew={isCreating}
          isDefault={selectedPromptId === defaultPromptId}
          onSave={handleSave}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
