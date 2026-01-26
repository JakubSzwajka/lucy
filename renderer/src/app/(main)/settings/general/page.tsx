"use client";

import { useRouter } from "next/navigation";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { useSettings } from "@/hooks/useSettings";
import { useSystemPrompts } from "@/hooks/useSystemPrompts";
import { useMainContext } from "../../layout";

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { settings, isLoading, updateSettings } = useSettings();
  const { prompts, isLoading: promptsLoading } = useSystemPrompts();
  const { availableProviders } = useMainContext();

  if (isLoading || promptsLoading) {
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
    <GeneralSettings
      settings={settings}
      systemPrompts={prompts}
      availableProviders={availableProviders}
      onUpdateSettings={updateSettings}
      onNavigateToPrompts={() => router.push("/settings/prompts")}
    />
  );
}
