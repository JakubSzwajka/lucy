"use client";

import { QuickActionsSettings } from "@/components/settings/QuickActionsSettings";
import { useQuickActions } from "@/hooks/useQuickActions";

export default function QuickActionsSettingsPage() {
  const {
    actions,
    isLoading,
    createAction,
    updateAction,
    deleteAction,
  } = useQuickActions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <QuickActionsSettings
      actions={actions}
      onCreateAction={createAction}
      onUpdateAction={updateAction}
      onDeleteAction={deleteAction}
    />
  );
}
