"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ReflectionIndicator } from "./ReflectionIndicator";
import { PlanPanel } from "@/components/plan";
import { useSessionChat } from "@/hooks/useAgentChat";
import { useMcpStatus } from "@/hooks/useMcpStatus";
import { usePlan } from "@/hooks/usePlan";
import { useMainContext } from "@/app/(main)/layout";
import type { FileUIPart } from "ai";
import { isTextUIPart } from "ai";
import type { AvailableProviders } from "@/types";

interface ChatContainerProps {
  sessionId: string | null;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
}

export function ChatContainer({
  sessionId,
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
}: ChatContainerProps) {
  const { getModelConfig } = useMainContext();
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);

  const { messages, agent, childSessions, streamPlan, sendMessage, isLoading, rawMessages, status, hasMoreItems, isLoadingMore, loadMoreItems } = useSessionChat({
    sessionId,
    model: selectedModel,
  });

  // Desktop notification when stream ends
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "streaming" && status === "ready") {
      const electron = (window as Record<string, unknown>).electron as
        | { invoke: (channel: string, data: Record<string, string>) => void }
        | undefined;
      if (!electron) return;
      const lastAssistant = [...rawMessages].reverse().find((m) => m.role === "assistant");
      const text = lastAssistant?.parts
        ?.filter(isTextUIPart)
        .map((p) => p.text)
        .join("") || "";
      const firstSentences = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 200);
      electron.invoke("show-notification", {
        title: "Lucy",
        body: firstSentences || "Response complete",
      });
    }
  }, [status, rawMessages]);

  // MCP servers (global setting)
  const {
    allServers: mcpServers,
    enabledServers: enabledMcpServers,
    toggleServer: toggleMcpServer,
    isLoading: isMcpLoading,
  } = useMcpStatus();

  // Plan for current session (stream-driven with DB fallback)
  const { plan } = usePlan({
    sessionId,
    streamPlan,
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

  // Wrap sendMessage to include thinking preference and files
  const handleSendMessage = useCallback(
    (content: string, files?: FileUIPart[]) => {
      sendMessage(content, { thinkingEnabled, files });
    },
    [sendMessage, thinkingEnabled]
  );

  const handleQuickActionPrefill = useCallback((content: string) => {
    setPrefill({ text: content, nonce: Date.now() });
  }, []);

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
    <div className="relative flex h-full bg-background">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${getStatusIndicator()}`} />
            <div className="flex items-center gap-2">
              <span className="label-dark">AGENT //</span>
              <span className="label-dark font-medium">
                {agent?.name || "Lucy"}
              </span>
              {agent?.status && (
                <span className="label-dark text-muted-darker">
                  [{agent.status}]
                </span>
              )}
            </div>
          </div>
          <ReflectionIndicator sessionId={sessionId} chatStatus={status} />
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onQuickAction={handleQuickActionPrefill}
          childSessions={childSessions}
          hasMoreItems={hasMoreItems}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreItems}
        />

        {/* Plan Panel (shows above input when plan exists) */}
        {plan && <PlanPanel plan={plan} />}

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          prefillText={prefill?.text}
          prefillNonce={prefill?.nonce}
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
          sessionId={sessionId}
          mcpServers={mcpServers}
          enabledMcpServers={enabledMcpServers}
          onMcpToggle={toggleMcpServer}
          isMcpLoading={isMcpLoading}
        />
      </div>

    </div>
  );
}
