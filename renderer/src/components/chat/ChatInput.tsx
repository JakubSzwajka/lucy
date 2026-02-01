"use client";

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react";
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
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate context usage
  const contextUsage = useMemo(() => {
    if (!modelConfig) return null;
    const tokens = estimateConversationTokens(messages);
    return getContextUsage(tokens, modelConfig.maxContextTokens);
  }, [messages, modelConfig]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift + Enter: allow default behavior (new line)
        return;
      }
      // Plain Enter: send message
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="p-6 border-t border-border bg-background">
      <div className="relative flex items-end gap-3 border border-border rounded-lg p-2 focus-within:border-muted-darker transition-all bg-background-secondary/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or command..."
          rows={1}
          className="w-full bg-transparent border-none text-sm py-2 px-2 resize-none min-h-[40px] max-h-32 focus:outline-none focus:ring-0 placeholder:text-muted-dark"
          disabled={isLoading}
        />

        <div className="flex items-center gap-2 pb-1 pr-1">
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="btn-ship"
          >
            Ship
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-4 justify-between">
        <div className="flex gap-4">
          <span className="label-sm text-muted-darkest">SHORTCUTS: ENTER TO SHIP • SHIFT+ENTER FOR NEW LINE</span>
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
