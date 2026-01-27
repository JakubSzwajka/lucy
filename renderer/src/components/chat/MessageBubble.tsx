"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { InlineActivityList } from "./AgentActivity";
import type { AgentActivity } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp?: Date;
  activities?: AgentActivity[];
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, model, timestamp, activities, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";
  const hasActivities = activities && activities.length > 0;
  const hasContent = content && content.trim().length > 0;

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
        {/* Inline activities (collapsed by default) */}
        {!isUser && (hasActivities || (isStreaming && !hasContent)) && (
          <InlineActivityList
            activities={activities ?? []}
            isStreaming={isStreaming && !hasContent}
          />
        )}

        {/* Main content */}
        {hasContent && (
          <div className="markdown-content break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator when no content and no activities */}
        {isStreaming && !hasContent && !hasActivities && (
          <div className="flex space-x-2">
            <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:100ms]" />
            <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        )}
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
