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
  const { messages, agent, childSessions, streamPlan, sendMessage, rewindToMessage, cancelGeneration, isLoading, rawMessages, status, hasMoreItems, isLoadingMore, loadMoreItems } = useSessionChat({
    sessionId,
    model: selectedModel,
  });

  // Browser notification when stream ends
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "streaming" && status === "ready") {
      if (!("Notification" in window) || Notification.permission === "denied") return;
      const lastAssistant = [...rawMessages].reverse().find((m) => m.role === "assistant");
      const text = lastAssistant?.parts
        ?.filter(isTextUIPart)
        .map((p) => p.text)
        .join("") || "";
      const firstSentences = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 200);
      const show = () => new Notification("Lucy", { body: firstSentences || "Response complete" });
      if (Notification.permission === "granted") {
        show();
      } else {
        Notification.requestPermission().then((p) => { if (p === "granted") show(); });
      }
    }
  }, [status, rawMessages]);

  const {
    allServers: mcpServers,
    enabledServers: enabledMcpServers,
    toggleServer: toggleMcpServer,
    isLoading: isMcpLoading,
  } = useMcpStatus();

  const { plan } = usePlan({
    sessionId,
    streamPlan,
  });

  const modelConfig = getModelConfig(selectedModel);
  const supportsThinking = modelConfig?.supportsReasoning ?? false;

  const [thinkingEnabled, setThinkingEnabled] = useState(supportsThinking);

  useEffect(() => {
    setThinkingEnabled(supportsThinking);
  }, [supportsThinking]);

  const handleSendMessage = useCallback(
    (content: string, files?: FileUIPart[]) => {
      sendMessage(content, { thinkingEnabled, files });
    },
    [sendMessage, thinkingEnabled]
  );

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
      <div className="flex flex-col flex-1 min-w-0">
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

        <MessageList
          messages={messages}
          isLoading={isLoading}
          childSessions={childSessions}
          hasMoreItems={hasMoreItems}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreItems}
          onRewind={rewindToMessage}
        />

        {plan && <PlanPanel plan={plan} />}

        <ChatInput
          onSend={handleSendMessage}
          onStop={cancelGeneration}
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
