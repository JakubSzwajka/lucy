"use client";

import { TriggersSettings } from "@/components/settings/TriggersSettings";
import { useTriggers } from "@/hooks/useTriggers";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";

export default function TriggersSettingsPage() {
  const { triggers, isLoading, createTrigger, updateTrigger, deleteTrigger } = useTriggers();
  const { configs } = useAgentConfigs();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <TriggersSettings
      triggers={triggers}
      agentConfigs={configs}
      onCreateTrigger={createTrigger}
      onUpdateTrigger={updateTrigger}
      onDeleteTrigger={deleteTrigger}
    />
  );
}
