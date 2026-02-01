"use client";

import { cn } from "@/lib/utils";
import { Brain, ChevronRight } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { useState, useEffect } from "react";

export type ReasoningProps = HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean;
  defaultOpen?: boolean;
  duration?: number;
  children: ReactNode;
};

const AUTO_CLOSE_DELAY = 1000;

export function Reasoning({
  className,
  isStreaming = false,
  defaultOpen = true,
  duration,
  children,
  ...props
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasAutoClosed, setHasAutoClosed] = useState(false);

  // Auto-close when streaming ends
  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen, defaultOpen, hasAutoClosed]);

  return (
    <div
      className={cn("border border-border/50 rounded-lg overflow-hidden bg-background/30", className)}
      {...props}
    >
      <ReasoningTrigger
        isOpen={isOpen}
        isStreaming={isStreaming}
        duration={duration}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <ReasoningContent>{children}</ReasoningContent>
      )}
    </div>
  );
}

type ReasoningTriggerProps = {
  isOpen: boolean;
  isStreaming: boolean;
  duration?: number;
  onClick: () => void;
};

function ReasoningTrigger({ isOpen, isStreaming, duration, onClick }: ReasoningTriggerProps) {
  const getMessage = () => {
    if (isStreaming) {
      return "Thinking...";
    }
    if (duration === undefined || duration === 0) {
      return "Thought for a few seconds";
    }
    return `Thought for ${duration} seconds`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background/50 transition-colors"
    >
      <ChevronRight
        className={cn(
          "w-3 h-3 transform transition-transform text-muted",
          isOpen && "rotate-90"
        )}
      />
      <Brain
        className={cn(
          "w-4 h-4 text-purple-400",
          isStreaming && "animate-pulse"
        )}
      />
      <span className="flex-1 text-left label-dark">
        {getMessage()}
      </span>
      {isStreaming && (
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:100ms]" />
          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:200ms]" />
        </div>
      )}
    </button>
  );
}

type ReasoningContentProps = {
  children: ReactNode;
};

function ReasoningContent({ children }: ReasoningContentProps) {
  return (
    <div className="px-3 py-2 border-t border-border/30 text-xs text-muted-dark leading-relaxed max-h-64 overflow-y-auto">
      <div className="whitespace-pre-wrap break-words font-mono">
        {children}
      </div>
    </div>
  );
}
