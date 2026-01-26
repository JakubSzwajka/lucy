"use client";

import { useState, useRef, useEffect } from "react";
import type { McpServer, McpServerStatus } from "@/types";

interface ToolsSelectorProps {
  availableServers: McpServer[];
  enabledServers: McpServerStatus[];
  onToggle: (serverId: string, enabled: boolean) => void;
  isLoading?: boolean;
}

export function ToolsSelector({
  availableServers,
  enabledServers,
  onToggle,
  isLoading,
}: ToolsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const enabledIds = new Set(enabledServers.map((s) => s.serverId));
  const totalTools = enabledServers.reduce((acc, s) => acc + s.tools.length, 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render if no servers are configured
  if (availableServers.length === 0) {
    return null;
  }

  const getStatusDot = (serverId: string) => {
    const status = enabledServers.find((s) => s.serverId === serverId);
    if (!status) return null;

    if (status.connected) {
      return (
        <span
          className="w-1.5 h-1.5 rounded-full bg-green-500"
          title={`Connected - ${status.tools.length} tools`}
        />
      );
    }
    if (status.error) {
      return (
        <span
          className="w-1.5 h-1.5 rounded-full bg-red-500"
          title={status.error}
        />
      );
    }
    return (
      <span
        className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"
        title="Connecting..."
      />
    );
  };

  return (
    <div className="flex items-center gap-2 relative" ref={dropdownRef}>
      <span className="label-dark">TOOLS //</span>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 bg-transparent border border-border rounded px-3 py-1.5 text-xs mono uppercase tracking-wide text-foreground focus:outline-none focus:border-muted-darker cursor-pointer hover:border-muted-darker transition-colors"
      >
        <span>
          {enabledServers.length > 0 ? (
            <>
              {enabledServers.length} server{enabledServers.length !== 1 ? "s" : ""}
              <span className="text-muted-dark ml-1">({totalTools} tools)</span>
            </>
          ) : (
            <span className="text-muted-dark">None selected</span>
          )}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[280px] bg-background border border-border rounded-lg shadow-xl py-2">
          <div className="px-3 py-1.5 border-b border-border mb-1">
            <span className="text-xs text-muted-dark uppercase tracking-wide">
              Available MCP Servers
            </span>
          </div>

          {availableServers.map((server) => {
            const isEnabled = enabledIds.has(server.id);
            const status = enabledServers.find((s) => s.serverId === server.id);
            const toolCount = status?.tools.length ?? 0;

            return (
              <button
                key={server.id}
                onClick={() => onToggle(server.id, !isEnabled)}
                disabled={isLoading}
                className="w-full text-left px-3 py-2 hover:bg-background-secondary transition-colors flex items-center gap-3"
              >
                {/* Checkbox */}
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    isEnabled
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-border hover:border-muted-dark"
                  }`}
                >
                  {isEnabled && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Server info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEnabled && getStatusDot(server.id)}
                    <span className="text-sm font-medium truncate">{server.name}</span>
                  </div>
                  {server.description && (
                    <div className="text-xs text-muted-dark truncate mt-0.5">
                      {server.description}
                    </div>
                  )}
                </div>

                {/* Tool count */}
                {isEnabled && status?.connected && (
                  <span className="text-xs text-muted-dark flex-shrink-0">
                    {toolCount} tool{toolCount !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}

          {availableServers.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-dark">
              No MCP servers configured
            </div>
          )}
        </div>
      )}
    </div>
  );
}
