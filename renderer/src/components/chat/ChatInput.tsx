"use client";

import { useMemo } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { estimateConversationTokens, getContextUsage } from "@/lib/ai/tokens";
import type { ChatMessage, ModelConfig } from "@/types";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  messages?: ChatMessage[];
  modelConfig?: ModelConfig;
}

export function ChatInput({
  onSend,
  isLoading,
  messages = [],
  modelConfig,
}: ChatInputProps) {
  const contextUsage = useMemo(() => {
    if (!modelConfig) return null;
    const tokens = estimateConversationTokens(messages);
    return getContextUsage(tokens, modelConfig.maxContextTokens);
  }, [messages, modelConfig]);

  const handleSubmit = ({ text }: { text: string }) => {
    if (text.trim()) {
      onSend(text.trim());
    }
  };

  return (
    <div className="p-6 border-t border-border bg-background">
      <PromptInput
        onSubmit={handleSubmit}
        className="border border-border rounded-lg p-2 focus-within:border-muted-darker transition-all bg-background-secondary/20"
      >
        <PromptInputTextarea
          placeholder="Type a message or command..."
          disabled={isLoading}
          className="min-h-[40px] max-h-32 py-2 px-2 text-sm border-none bg-transparent focus:outline-none focus:ring-0 placeholder:text-muted-dark"
        />
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit
            disabled={isLoading}
            className="btn-ship"
            status={isLoading ? "streaming" : undefined}
          >
            Ship
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>

      <div className="mt-2 flex gap-4 justify-between">
        <div className="flex gap-4">
          <span className="label-sm text-muted-darkest">
            SHORTCUTS: ENTER TO SHIP • SHIFT+ENTER FOR NEW LINE
          </span>
          <span className="label-sm text-muted-darkest">MODE: CHAT_v1.0</span>
        </div>
        {contextUsage && (
          <span
            className={`label-sm ${
              contextUsage.isOverLimit
                ? "text-red-500"
                : contextUsage.isNearLimit
                  ? "text-yellow-500"
                  : "text-muted-darkest"
            }`}
          >
            CTX: {contextUsage.formatted} ({contextUsage.percentage}%)
          </span>
        )}
      </div>
    </div>
  );
}
