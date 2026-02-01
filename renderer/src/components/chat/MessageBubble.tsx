"use client";

import { useMemo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { InlineActivityList, ReasoningPartView, ToolCallPartView } from "./AgentActivity";
import type { AgentActivity, ContentPart } from "@/types";
import { Copy, Check } from "lucide-react";

/**
 * Code block with copy button
 */
function CodeBlockWithCopy({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = String(children).trim();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp?: Date;
  parts?: ContentPart[];
  activities?: AgentActivity[];
  isStreaming?: boolean;
}

/**
 * Custom code block renderer
 */
function createCodeComponent(): Components["code"] {
  return function CodeBlock({ className, children, ...props }) {
    // If there's no className, it's inline code
    const isInline = !className;

    if (isInline) {
      return <code className={className} {...props}>{children}</code>;
    }

    // Block code - render with copy button
    return <CodeBlockWithCopy className={className}>{children}</CodeBlockWithCopy>;
  };
}

export function MessageBubble({ role, content, model, timestamp, parts, activities, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";
  const hasParts = parts && parts.length > 0;
  const hasActivities = activities && activities.length > 0;
  const hasContent = content && content.trim().length > 0;

  // Memoize the markdown components to avoid recreation on each render
  const markdownComponents = useMemo<Components>(
    () => ({
      code: createCodeComponent(),
      // Wrap pre to prevent double wrapping (code component handles blocks)
      pre: ({ children }) => <>{children}</>,
    }),
    []
  );

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  // Render interleaved parts if available
  const renderInterleavedContent = () => {
    if (!hasParts) {
      // Fallback to old behavior if no parts
      return (
        <>
          {/* Inline activities (collapsed by default) - legacy */}
          {!isUser && (hasActivities || (isStreaming && !hasContent)) && (
            <InlineActivityList
              activities={activities ?? []}
              isStreaming={isStreaming && !hasContent}
            />
          )}

          {/* Main content */}
          {hasContent && (
            <div className="markdown-content break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </>
      );
    }

    // Render parts in order
    return (
      <div className="space-y-3">
        {parts.map((part) => {
          switch (part.type) {
            case "reasoning":
              return (
                <ReasoningPartView
                  key={part.id}
                  id={part.id}
                  content={part.content}
                  summary={part.summary}
                />
              );
            case "tool_call":
              return (
                <ToolCallPartView
                  key={part.id}
                  id={part.id}
                  callId={part.callId}
                  toolName={part.toolName}
                  args={part.args}
                  status={part.status}
                  result={part.result}
                  error={part.error}
                />
              );
            case "text":
              return (
                <div key={part.id} className="markdown-content break-words">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {part.text}
                  </ReactMarkdown>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
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
        {isUser ? (
          // User messages - just show content
          hasContent && (
            <div className="markdown-content break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )
        ) : (
          // Assistant messages - show interleaved content
          renderInterleavedContent()
        )}

        {/* Streaming indicator when no content and no parts */}
        {isStreaming && !hasContent && !hasParts && !hasActivities && (
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
