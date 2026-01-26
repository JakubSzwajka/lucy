"use client";

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { usePersistentChat } from "@/hooks/usePersistentChat";
import type { AvailableProviders } from "@/types";

interface ChatContainerProps {
  conversationId: string | null;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
}

export function ChatContainer({
  conversationId,
  selectedModel,
  onModelChange,
  availableProviders,
}: ChatContainerProps) {
  const { messages, sendMessage, isLoading } = usePersistentChat({
    conversationId,
    model: selectedModel,
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
          <div>
            <span className="label-dark">CURRENT_CONTEXT //</span>
            <span className="text-sm font-medium ml-1 uppercase tracking-tight">Lucy</span>
          </div>
        </div>
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          availableProviders={availableProviders}
        />
      </header>

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
