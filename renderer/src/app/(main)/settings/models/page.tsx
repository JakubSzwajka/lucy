"use client";

import { ModelsSettings } from "@/components/settings/ModelsSettings";
import { useSettings } from "@/hooks/useSettings";
import { useMainContext } from "../../layout";

export default function ModelsSettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();
  const { availableProviders } = useMainContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Failed to load settings</span>
      </div>
    );
  }

  return (
    <ModelsSettings
      settings={settings}
      availableProviders={availableProviders}
      onUpdateSettings={updateSettings}
    />
  );
}
