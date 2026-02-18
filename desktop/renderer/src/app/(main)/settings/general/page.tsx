"use client";

import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { useSettings } from "@/hooks/useSettings";

export default function GeneralSettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();

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
    <div className="p-6">
      <GeneralSettings
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}
