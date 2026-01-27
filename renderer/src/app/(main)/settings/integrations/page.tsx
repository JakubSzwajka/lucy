"use client";

import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { useIntegrations } from "@/hooks/useIntegrations";

export default function IntegrationsSettingsPage() {
  const {
    integrations,
    isLoading,
    updateIntegration,
    deleteIntegration,
    testConnection,
  } = useIntegrations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <IntegrationsSettings
      integrations={integrations}
      onUpdateIntegration={updateIntegration}
      onDeleteIntegration={deleteIntegration}
      onTestConnection={testConnection}
    />
  );
}
