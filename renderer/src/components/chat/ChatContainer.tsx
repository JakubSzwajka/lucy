"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { PlanPanel } from "@/components/plan";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useMcpStatus } from "@/hooks/useMcpStatus";
import { usePlan } from "@/hooks/usePlan";
import { getModelConfig } from "@/lib/ai/models";
import type { AvailableProviders } from "@/types";

interface ChatContainerProps {
  sessionId: string | null;
  agentId: string | null;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
}

export function ChatContainer({
  sessionId,
  agentId,
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
}: ChatContainerProps) {
  const { messages, agent, sendMessage, isLoading } = useAgentChat({
    sessionId,
    agentId,
    model: selectedModel,
  });

  // MCP servers (global setting)
  const {
    allServers: mcpServers,
    enabledServers: enabledMcpServers,
    toggleServer: toggleMcpServer,
    isLoading: isMcpLoading,
  } = useMcpStatus();

  // Plan for current session (refreshes when agent finishes responding)
  const { plan } = usePlan({
    sessionId,
    isAgentResponding: isLoading
  });

  // Get model config to check thinking support
  const modelConfig = getModelConfig(selectedModel);
  const supportsThinking = modelConfig?.supportsReasoning ?? false;

  // Thinking toggle state - default to true if model supports it
  const [thinkingEnabled, setThinkingEnabled] = useState(supportsThinking);

  // Update thinking state when model changes
  useEffect(() => {
    setThinkingEnabled(supportsThinking);
  }, [supportsThinking]);

  // Wrap sendMessage to include thinking preference
  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content, { thinkingEnabled });
    },
    [sendMessage, thinkingEnabled]
  );

  // Get agent status indicator
  const getStatusIndicator = () => {
    if (!agent) return "bg-muted-dark";
    switch (agent.status) {
      case "running":
        return "bg-status-online animate-pulse";
      case "waiting":
        return "bg-status-online";
      case "pending":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-muted-dark";
      default:
        return "bg-status-online";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${getStatusIndicator()}`} />
          <div>
            <span className="label-dark">AGENT //</span>
            <span className="text-sm font-medium ml-1 uppercase tracking-tight">
              {agent?.name || "Lucy"}
            </span>
            {agent?.status && (
              <span className="text-xs text-muted-dark ml-2">
                [{agent.status}]
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
      />

      {/* Plan Panel (shows above input when plan exists) */}
      {plan && <PlanPanel plan={plan} />}

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        messages={messages}
        modelConfig={modelConfig}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        availableProviders={availableProviders}
        enabledModels={enabledModels}
        thinkingEnabled={thinkingEnabled}
        onThinkingChange={setThinkingEnabled}
        supportsThinking={supportsThinking}
        mcpServers={mcpServers}
        enabledMcpServers={enabledMcpServers}
        onMcpToggle={toggleMcpServer}
        isMcpLoading={isMcpLoading}
      />
    </div>
  );
}
