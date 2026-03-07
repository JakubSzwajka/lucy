"use client";

import { useState } from "react";
import type { McpServer, McpServerCreate, McpServerUpdate } from "@/types";
import { McpServerForm } from "./McpServerForm";

interface McpServersSettingsProps {
  servers: McpServer[];
  onCreateServer: (data: McpServerCreate) => Promise<McpServer>;
  onUpdateServer: (id: string, data: McpServerUpdate) => Promise<McpServer>;
  onDeleteServer: (id: string) => Promise<void>;
  onTestConnection?: (id: string) => Promise<{ success: boolean; tools?: string[]; error?: string }>;
}

export function McpServersSettings({
  servers,
  onCreateServer,
  onUpdateServer,
  onDeleteServer,
  onTestConnection,
}: McpServersSettingsProps) {
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; success?: boolean; tools?: string[]; error?: string }>>({});

  const handleCreate = async (data: McpServerCreate | McpServerUpdate) => {
    await onCreateServer(data as McpServerCreate);
    setIsCreating(false);
  };

  const handleUpdate = async (data: McpServerCreate | McpServerUpdate) => {
    if (editingServer) {
      await onUpdateServer(editingServer.id, data as McpServerUpdate);
      setEditingServer(null);
    }
  };

  const handleDelete = async (server: McpServer) => {
    if (confirm(`Delete "${server.name}"? This will remove it from all sessions.`)) {
      await onDeleteServer(server.id);
    }
  };

  const handleTestConnection = async (server: McpServer) => {
    if (!onTestConnection) return;

    setTestResults((prev) => ({
      ...prev,
      [server.id]: { loading: true },
    }));

    try {
      const result = await onTestConnection(server.id);
      setTestResults((prev) => ({
        ...prev,
        [server.id]: { loading: false, ...result },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [server.id]: { loading: false, success: false, error: err instanceof Error ? err.message : "Test failed" },
      }));
    }
  };

  const handleToggleEnabled = async (server: McpServer) => {
    await onUpdateServer(server.id, { enabled: !server.enabled });
  };

  const handleToggleApproval = async (server: McpServer) => {
    await onUpdateServer(server.id, { requireApproval: !server.requireApproval });
  };

  const getTransportLabel = (server: McpServer): string => {
    if (server.transportType === "stdio") {
      return `stdio: ${server.command}`;
    }
    return `${server.transportType}: ${server.url}`;
  };

  if (isCreating) {
    return (
      <McpServerForm
        onSave={handleCreate}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  if (editingServer) {
    return (
      <McpServerForm
        server={editingServer}
        onSave={handleUpdate}
        onCancel={() => setEditingServer(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-dark">
          Configure external tool providers using the Model Context Protocol (MCP).
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 text-xs bg-foreground text-background rounded hover:opacity-90 transition-opacity"
        >
          Add Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="border border-border border-dashed rounded p-8 text-center">
          <p className="text-sm text-muted-dark mb-3">No MCP servers configured</p>
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs text-foreground hover:underline"
          >
            Add your first MCP server
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const testResult = testResults[server.id];

            return (
              <div
                key={server.id}
                className={`border border-border rounded p-4 ${
                  !server.enabled ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{server.name}</span>
                      {!server.enabled && (
                        <span className="text-xs text-muted-dark">(disabled)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-dark mt-0.5 font-mono">
                      {getTransportLabel(server)}
                    </p>
                    {server.description && (
                      <p className="text-xs text-muted-dark mt-1">{server.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingServer(server)}
                      className="text-xs text-muted-dark hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(server)}
                      className="text-xs text-muted-dark hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Settings toggles */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={() => handleToggleEnabled(server)}
                      className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={server.requireApproval}
                      onChange={() => handleToggleApproval(server)}
                      className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
                    />
                    <span className="text-xs">Require approval</span>
                  </label>

                  {onTestConnection && (
                    <button
                      onClick={() => handleTestConnection(server)}
                      disabled={testResult?.loading}
                      className="text-xs text-muted-dark hover:text-foreground disabled:opacity-50 ml-auto"
                    >
                      {testResult?.loading ? "Testing..." : "Test Connection"}
                    </button>
                  )}
                </div>

                {/* Test result */}
                {testResult && !testResult.loading && (
                  <div
                    className={`mt-3 p-2 rounded text-xs ${
                      testResult.success
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {testResult.success ? (
                      <div>
                        <span className="font-medium">Connected!</span>
                        {testResult.tools && testResult.tools.length > 0 && (
                          <span className="ml-2 text-muted-dark">
                            {testResult.tools.length} tool{testResult.tools.length !== 1 ? "s" : ""} available
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>{testResult.error || "Connection failed"}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
