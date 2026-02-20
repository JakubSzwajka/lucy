"use client";

import { useState } from "react";
import type { McpServer, McpServerCreate, McpServerUpdate, McpTransportType } from "@/types";

interface McpServerFormProps {
  server?: McpServer;
  onSave: (data: McpServerCreate | McpServerUpdate) => Promise<void>;
  onCancel: () => void;
}

export function McpServerForm({ server, onSave, onCancel }: McpServerFormProps) {
  const [name, setName] = useState(server?.name || "");
  const [description, setDescription] = useState(server?.description || "");
  const [transportType, setTransportType] = useState<McpTransportType>(
    server?.transportType || "stdio"
  );
  const [command, setCommand] = useState(server?.command || "");
  const [args, setArgs] = useState(server?.args?.join("\n") || "");
  const [envVars, setEnvVars] = useState(
    server?.env
      ? Object.entries(server.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : ""
  );
  const [url, setUrl] = useState(server?.url || "");
  const [headers, setHeaders] = useState(
    server?.headers
      ? Object.entries(server.headers)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : ""
  );
  const [requireApproval, setRequireApproval] = useState(server?.requireApproval || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseKeyValuePairs = (input: string): Record<string, string> => {
    const result: Record<string, string> = {};
    input
      .split("\n")
      .filter((line) => line.trim())
      .forEach((line) => {
        const eqIndex = line.indexOf("=");
        if (eqIndex > 0) {
          const key = line.slice(0, eqIndex).trim();
          const value = line.slice(eqIndex + 1).trim();
          if (key) result[key] = value;
        }
      });
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (transportType === "stdio" && !command.trim()) {
      setError("Command is required for stdio transport");
      return;
    }

    if ((transportType === "http" || transportType === "sse") && !url.trim()) {
      setError("URL is required for HTTP/SSE transport");
      return;
    }

    setIsSaving(true);

    try {
      const data: McpServerCreate | McpServerUpdate = {
        name: name.trim(),
        description: description.trim() || undefined,
        transportType,
        requireApproval,
      };

      if (transportType === "stdio") {
        data.command = command.trim();
        data.args = args
          .split("\n")
          .map((a) => a.trim())
          .filter(Boolean);
        const parsedEnv = parseKeyValuePairs(envVars);
        data.env = Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined;
        // Clear HTTP fields
        data.url = null;
        data.headers = null;
      } else {
        data.url = url.trim();
        const parsedHeaders = parseKeyValuePairs(headers);
        data.headers = Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined;
        // Clear stdio fields
        data.command = null;
        data.args = null;
        data.env = null;
      }

      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="label">{server ? "Edit MCP Server" : "Add MCP Server"}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-dark hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs text-muted-dark mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Todoist, Filesystem"
          className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-muted-dark mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground"
        />
      </div>

      {/* Transport Type */}
      <div>
        <label className="block text-xs text-muted-dark mb-2">Transport Type *</label>
        <div className="flex gap-4">
          {(["stdio", "http", "sse"] as McpTransportType[]).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transportType"
                value={type}
                checked={transportType === type}
                onChange={() => setTransportType(type)}
                className="w-4 h-4"
              />
              <span className="text-sm uppercase">{type}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-dark mt-1">
          {transportType === "stdio"
            ? "For local CLI tools (e.g., npx @anthropic/mcp-server)"
            : "For remote MCP servers via HTTP"}
        </p>
      </div>

      {/* Stdio fields */}
      {transportType === "stdio" && (
        <>
          <div>
            <label className="block text-xs text-muted-dark mb-1">Command *</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., npx, /usr/local/bin/mcp-server"
              className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-dark mb-1">
              Arguments <span className="text-muted-darker">(one per line)</span>
            </label>
            <textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={"-y\n@anthropic/mcp-todoist"}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground font-mono resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-dark mb-1">
              Environment Variables <span className="text-muted-darker">(KEY=value per line)</span>
            </label>
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder="TODOIST_API_KEY=your-api-key"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground font-mono resize-none"
            />
          </div>
        </>
      )}

      {/* HTTP/SSE fields */}
      {(transportType === "http" || transportType === "sse") && (
        <>
          <div>
            <label className="block text-xs text-muted-dark mb-1">URL *</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp-server.example.com"
              className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-dark mb-1">
              Headers <span className="text-muted-darker">(Key=value per line)</span>
            </label>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder="Authorization=Bearer your-token"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-foreground font-mono resize-none"
            />
          </div>
        </>
      )}

      {/* Require Approval */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
          />
          <span className="text-sm">Require approval before executing tools</span>
        </label>
        <p className="text-xs text-muted-dark mt-1 ml-6">
          When enabled, you&apos;ll be asked to approve each tool call before it runs.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-dark hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 text-sm bg-foreground text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "Saving..." : server ? "Save Changes" : "Add Server"}
        </button>
      </div>
    </form>
  );
}
