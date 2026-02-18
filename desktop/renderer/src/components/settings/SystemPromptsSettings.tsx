"use client";

import { useState } from "react";
import { PromptsList } from "./PromptsList";
import { PromptEditor } from "./PromptEditor";
import type {
  SystemPrompt,
  SystemPromptCreate,
  SystemPromptUpdate,
} from "@/types";

interface SystemPromptsSettingsProps {
  prompts: SystemPrompt[];
  onCreatePrompt: (data: SystemPromptCreate) => Promise<SystemPrompt>;
  onUpdatePrompt: (id: string, data: SystemPromptUpdate) => Promise<SystemPrompt>;
  onDeletePrompt: (id: string) => Promise<void>;
}

export function SystemPromptsSettings({
  prompts,
  onCreatePrompt,
  onUpdatePrompt,
  onDeletePrompt,
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
          onSelectPrompt={handleSelectPrompt}
          onNewPrompt={handleNewPrompt}
        />
      </div>

      {/* Right panel: Editor */}
      <div className="flex-1 bg-background">
        <PromptEditor
          prompt={selectedPrompt}
          isNew={isCreating}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
