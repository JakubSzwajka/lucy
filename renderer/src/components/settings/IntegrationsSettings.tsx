"use client";

import { useState } from "react";
import type { Integration, IntegrationUpdate, IntegrationTestResult } from "@/types";

interface IntegrationsSettingsProps {
  integrations: Integration[];
  onUpdateIntegration: (id: string, data: IntegrationUpdate) => Promise<Integration>;
  onDeleteIntegration: (id: string) => Promise<void>;
  onTestConnection: (
    id: string,
    credentials: Record<string, string>
  ) => Promise<IntegrationTestResult>;
}

export function IntegrationsSettings({
  integrations,
  onUpdateIntegration,
  onDeleteIntegration,
  onTestConnection,
}: IntegrationsSettingsProps) {
  const [configuringIntegration, setConfiguringIntegration] =
    useState<Integration | null>(null);

  const handleToggleEnabled = async (integration: Integration) => {
    if (!integration.isConfigured) {
      // Need to configure first
      setConfiguringIntegration(integration);
      return;
    }
    await onUpdateIntegration(integration.id, { enabled: !integration.enabled });
  };

  const handleConfigure = (integration: Integration) => {
    setConfiguringIntegration(integration);
  };

  const handleDisconnect = async (integration: Integration) => {
    if (
      confirm(
        `Disconnect "${integration.name}"? This will remove your credentials.`
      )
    ) {
      await onDeleteIntegration(integration.id);
    }
  };

  const handleSaveConfig = async (
    credentials: Record<string, string>,
    config: Record<string, unknown>
  ) => {
    if (!configuringIntegration) return;

    await onUpdateIntegration(configuringIntegration.id, {
      credentials,
      config,
      enabled: true,
    });
    setConfiguringIntegration(null);
  };

  if (configuringIntegration) {
    return (
      <IntegrationConfigForm
        integration={configuringIntegration}
        onSave={handleSaveConfig}
        onCancel={() => setConfiguringIntegration(null)}
        onTestConnection={onTestConnection}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-dark">
        Connect external services to give the AI access to your tasks, notes,
        and more.
      </p>

      {integrations.length === 0 ? (
        <div className="border border-border border-dashed rounded p-8 text-center">
          <p className="text-sm text-muted-dark">No integrations available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`border border-border rounded p-4 ${
                !integration.enabled ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {integration.name}
                    </span>
                    {integration.isConfigured && !integration.enabled && (
                      <span className="text-xs text-muted-dark">(disabled)</span>
                    )}
                    {!integration.isConfigured && (
                      <span className="text-xs text-yellow-500">
                        (not configured)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-dark mt-1">
                    {integration.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfigure(integration)}
                    className="text-xs text-muted-dark hover:text-foreground"
                  >
                    Configure
                  </button>
                  {integration.isConfigured && (
                    <button
                      onClick={() => handleDisconnect(integration)}
                      className="text-xs text-muted-dark hover:text-red-500"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Enable toggle - only show if configured */}
              {integration.isConfigured && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integration.enabled}
                      onChange={() => handleToggleEnabled(integration)}
                      className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Configuration Form Component
// ============================================================================

interface IntegrationConfigFormProps {
  integration: Integration;
  onSave: (
    credentials: Record<string, string>,
    config: Record<string, unknown>
  ) => Promise<void>;
  onCancel: () => void;
  onTestConnection: (
    id: string,
    credentials: Record<string, string>
  ) => Promise<IntegrationTestResult>;
}

function IntegrationConfigForm({
  integration,
  onSave,
  onCancel,
  onTestConnection,
}: IntegrationConfigFormProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleCredentialChange = (field: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setError(null);
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleTest = async () => {
    // Validate required credentials
    const missingFields = integration.credentialFields
      .filter((f) => !credentials[f.name]?.trim())
      .map((f) => f.name);

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await onTestConnection(integration.id, credentials);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async () => {
    // Validate required credentials
    const missingFields = integration.credentialFields
      .filter((f) => !credentials[f.name]?.trim())
      .map((f) => f.name);

    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(credentials, config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Configure {integration.name}</h3>
        <button
          onClick={onCancel}
          className="text-xs text-muted-dark hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-muted-dark">{integration.description}</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Credential fields */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-dark uppercase tracking-wide">
          Credentials
        </div>
        {integration.credentialFields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs text-muted-dark mb-1">
              {field.name}
              {field.description && (
                <span className="text-muted-darker ml-1">
                  ({field.description})
                </span>
              )}
            </label>
            <input
              type="password"
              value={credentials[field.name] || ""}
              onChange={(e) => handleCredentialChange(field.name, e.target.value)}
              placeholder={`Enter ${field.name}`}
              className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
            />
          </div>
        ))}
      </div>

      {/* Config fields (if any) */}
      {integration.configFields.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-dark uppercase tracking-wide">
            Options
          </div>
          {integration.configFields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs text-muted-dark mb-1">
                {field.name}
                {field.description && (
                  <span className="text-muted-darker ml-1">
                    ({field.description})
                  </span>
                )}
              </label>
              <input
                type="text"
                value={config[field.name] || ""}
                onChange={(e) => handleConfigChange(field.name, e.target.value)}
                placeholder={`Enter ${field.name} (optional)`}
                className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
              />
            </div>
          ))}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className={`p-3 rounded text-xs ${
            testResult.success
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {testResult.success ? (
            <div>
              <span className="font-medium">Connected!</span>
              {testResult.info && (
                <span className="ml-2 text-muted-dark">{testResult.info}</span>
              )}
            </div>
          ) : (
            <span>{testResult.error || "Connection failed"}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        {integration.hasTestConnection ? (
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-background-secondary disabled:opacity-50"
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-background-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save & Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
