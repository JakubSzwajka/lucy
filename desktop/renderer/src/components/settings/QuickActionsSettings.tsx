"use client";

import { useState } from "react";
import { QuickActionsList } from "./QuickActionsList";
import { QuickActionEditor } from "./QuickActionEditor";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

interface QuickActionsSettingsProps {
  actions: QuickAction[];
  onCreateAction: (data: QuickActionCreate) => Promise<QuickAction>;
  onUpdateAction: (id: string, data: QuickActionUpdate) => Promise<QuickAction>;
  onDeleteAction: (id: string) => Promise<void>;
}

export function QuickActionsSettings({
  actions,
  onCreateAction,
  onUpdateAction,
  onDeleteAction,
}: QuickActionsSettingsProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedAction = actions.find((a) => a.id === selectedActionId) || null;

  const handleSelectAction = (id: string | null) => {
    setSelectedActionId(id);
    setIsCreating(false);
  };

  const handleNewAction = () => {
    setSelectedActionId(null);
    setIsCreating(true);
  };

  const handleSave = async (data: QuickActionCreate | QuickActionUpdate) => {
    if (isCreating) {
      const created = await onCreateAction(data as QuickActionCreate);
      setSelectedActionId(created.id);
      setIsCreating(false);
    } else if (selectedActionId) {
      await onUpdateAction(selectedActionId, data as QuickActionUpdate);
    }
  };

  const handleDelete = async () => {
    if (selectedActionId) {
      await onDeleteAction(selectedActionId);
      setSelectedActionId(null);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setSelectedActionId(null);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="w-1/3 border-r border-border bg-background-secondary">
        <QuickActionsList
          actions={actions}
          selectedActionId={selectedActionId}
          onSelectAction={handleSelectAction}
          onNewAction={handleNewAction}
        />
      </div>

      <div className="flex-1 bg-background">
        <QuickActionEditor
          action={selectedAction}
          isNew={isCreating}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
