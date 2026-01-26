"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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

      <div className="mt-2 flex gap-4">
        <span className="label-sm text-muted-darkest">SHORTCUTS: CTRL+ENTER TO SHIP</span>
        <span className="label-sm text-muted-darkest">MODE: CHAT_v1.0</span>
      </div>
    </div>
  );
}
