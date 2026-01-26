"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp?: Date;
}

export function MessageBubble({ role, content, model, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  return (
    <div
      className={cn("flex flex-col gap-1 w-full", isUser ? "items-end" : "items-start")}
    >
      {/* Label */}
      <span className="label-dark mx-1">
        {isUser ? "USER //" : "// LUCY"}
      </span>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 border text-sm leading-relaxed",
          isUser
            ? "bg-user-bubble border-user-bubble-border"
            : "bg-assistant-bubble border-assistant-bubble-border"
        )}
      >
        <div className="markdown-content break-words">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>

      {/* Timestamp and model */}
      <div className="label-sm mx-1 flex items-center gap-2">
        {isUser ? "SENT" : "DELIVERED"}
        {timestamp && ` // ${formatTime(timestamp)}`}
        {!isUser && model && <span className="text-muted-darker">• {model}</span>}
      </div>
    </div>
  );
}
