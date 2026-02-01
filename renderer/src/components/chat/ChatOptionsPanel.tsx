"use client";

import { useState, useEffect, useRef } from "react";
import { ToolsSelector } from "./ToolsSelector";
import type { McpServer, McpServerStatus } from "@/types";

interface RegisteredToolInfo {
  key: string;
  name: string;
  description: string;
  source: {
    type: "mcp" | "builtin";
    serverId?: string;
    serverName?: string;
    moduleId?: string;
  };
}

interface ChatOptionsPanelProps {
  mcpServers?: McpServer[];
  enabledMcpServers?: McpServerStatus[];
  onMcpToggle?: (serverId: string, enabled: boolean) => void;
  isMcpLoading?: boolean;
}

export function ChatOptionsPanel({
  mcpServers = [],
  enabledMcpServers = [],
  onMcpToggle,
  isMcpLoading,
}: ChatOptionsPanelProps) {
  const [tools, setTools] = useState<RegisteredToolInfo[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch registered tools
  useEffect(() => {
    fetch("/api/tools")
      .then((res) => res.json())
      .then((data) => setTools(data.tools || []))
      .catch(() => setTools([]));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Group tools by source
  const builtinTools = tools.filter((t) => t.source.type === "builtin");
  const mcpTools = tools.filter((t) => t.source.type === "mcp");

  return (
    <div className="flex items-center justify-between">
      {/* Tools Dropdown */}
      <div className="flex items-center gap-2 relative" ref={toolsDropdownRef}>
        <span className="label-dark">TOOLS //</span>
        <button
          onClick={() => setIsToolsOpen(!isToolsOpen)}
          className="flex items-center gap-2 bg-transparent border border-border rounded px-3 py-1.5 text-xs mono uppercase tracking-wide text-foreground focus:outline-none focus:border-muted-darker cursor-pointer hover:border-muted-darker transition-colors"
        >
          <span>
            {tools.length > 0 ? (
              <span>{tools.length} available</span>
            ) : (
              <span className="text-muted-dark">None</span>
            )}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${isToolsOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isToolsOpen && (
          <div className="absolute bottom-full left-0 mb-1 z-50 min-w-[320px] max-h-[400px] overflow-y-auto bg-background border border-border rounded-lg shadow-xl py-2">
            {builtinTools.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-b border-border mb-1">
                  <span className="text-xs text-muted-dark uppercase tracking-wide">
                    Builtin Tools ({builtinTools.length})
                  </span>
                </div>
                {builtinTools.map((tool) => (
                  <div
                    key={tool.key}
                    className="px-3 py-2 hover:bg-background-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.name}</span>
                      <span className="text-xs text-muted-dark">
                        ({tool.source.moduleId})
                      </span>
                    </div>
                    <div className="text-xs text-muted-dark mt-0.5 line-clamp-1">
                      {tool.description}
                    </div>
                  </div>
                ))}
              </>
            )}

            {mcpTools.length > 0 && (
              <>
                <div className="px-3 py-1.5 border-b border-border mb-1 mt-2">
                  <span className="text-xs text-muted-dark uppercase tracking-wide">
                    MCP Tools ({mcpTools.length})
                  </span>
                </div>
                {mcpTools.map((tool) => (
                  <div
                    key={tool.key}
                    className="px-3 py-2 hover:bg-background-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.name}</span>
                      <span className="text-xs text-muted-dark">
                        ({tool.source.serverName || tool.source.serverId})
                      </span>
                    </div>
                    <div className="text-xs text-muted-dark mt-0.5 line-clamp-1">
                      {tool.description}
                    </div>
                  </div>
                ))}
              </>
            )}

            {tools.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-dark">
                No tools registered
              </div>
            )}
          </div>
        )}
      </div>

      {/* MCP Servers */}
      {mcpServers.length > 0 && onMcpToggle && (
        <ToolsSelector
          availableServers={mcpServers}
          enabledServers={enabledMcpServers}
          onToggle={onMcpToggle}
          isLoading={isMcpLoading}
        />
      )}
    </div>
  );
}
