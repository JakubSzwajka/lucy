"use client";

import { McpServersSettings } from "@/components/settings/McpServersSettings";
import { useMcpServers } from "@/hooks/useMcpServers";

export default function McpSettingsPage() {
  const {
    servers,
    isLoading,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
  } = useMcpServers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
    <McpServersSettings
      servers={servers}
      onCreateServer={createServer}
      onUpdateServer={updateServer}
      onDeleteServer={deleteServer}
      onTestConnection={testConnection}
    />
    </div>
  );
}
