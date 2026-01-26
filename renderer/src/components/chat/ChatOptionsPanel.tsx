"use client";

import { ModelSelector } from "./ModelSelector";
import { ToolsSelector } from "./ToolsSelector";
import type { AvailableProviders, McpServer, McpServerStatus } from "@/types";

interface ChatOptionsPanelProps {
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  supportsThinking: boolean;
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
  // MCP props
  mcpServers?: McpServer[];
  enabledMcpServers?: McpServerStatus[];
  onMcpToggle?: (serverId: string, enabled: boolean) => void;
  isMcpLoading?: boolean;
}

export function ChatOptionsPanel({
  thinkingEnabled,
  onThinkingChange,
  supportsThinking,
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
  mcpServers = [],
  enabledMcpServers = [],
  onMcpToggle,
  isMcpLoading,
}: ChatOptionsPanelProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-4">
        {supportsThinking && (
          <button
            type="button"
            onClick={() => onThinkingChange(!thinkingEnabled)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              thinkingEnabled
                ? "bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-400 border border-emerald-500/40"
                : "bg-background-secondary/50 text-muted-dark border border-border hover:border-muted-dark"
            }`}
          >
            <span className="text-sm">🧠</span>
            <span>Thinking</span>
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                thinkingEnabled
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : "bg-muted-dark"
              }`}
            />
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        {mcpServers.length > 0 && onMcpToggle && (
          <ToolsSelector
            availableServers={mcpServers}
            enabledServers={enabledMcpServers}
            onToggle={onMcpToggle}
            isLoading={isMcpLoading}
          />
        )}
        {selectedModel && onModelChange && (
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            availableProviders={availableProviders}
            enabledModels={enabledModels}
          />
        )}
      </div>
    </div>
  );
}
