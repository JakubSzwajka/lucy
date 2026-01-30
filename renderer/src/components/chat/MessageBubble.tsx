"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { InlineActivityList } from "./AgentActivity";
import {
  getInlineUIRegistration,
  validateInlineUIProps,
} from "@/lib/generative-ui/inline";
import type { AgentActivity } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp?: Date;
  activities?: AgentActivity[];
  isStreaming?: boolean;
  /** Callback for inline UI component actions */
  onUIAction?: (action: string, payload: unknown) => void;
}

/**
 * Custom code block renderer that handles lucy-ui components
 */
function createCodeComponent(
  onUIAction?: (action: string, payload: unknown) => void
): Components["code"] {
  return function CodeBlock({ className, children, ...props }) {
    const content = String(children).trim();

    // Check if this is a lucy-ui component code block
    // Format: ```lucy-ui:component-name
    const match = /^language-lucy-ui:(.+)$/.exec(className || "");

    if (match) {
      const componentName = match[1];
      const registration = getInlineUIRegistration(componentName);

      if (registration) {
        // Try to parse and validate the JSON content
        try {
          const jsonData = JSON.parse(content);
          const validation = validateInlineUIProps(componentName, jsonData);

          if (validation.success) {
            const Component = registration.component;
            return <Component {...(validation.data as object)} onAction={onUIAction} />;
          } else {
            // Validation failed - show error
            return (
              <div className="my-2 p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-sm">
                <div className="text-red-400 font-medium">Invalid UI component</div>
                <div className="text-muted text-xs mt-1">{validation.error}</div>
              </div>
            );
          }
        } catch (e) {
          // JSON parse failed - show error
          return (
            <div className="my-2 p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-sm">
              <div className="text-red-400 font-medium">Failed to parse UI component</div>
              <div className="text-muted text-xs mt-1">
                {e instanceof Error ? e.message : "Invalid JSON"}
              </div>
            </div>
          );
        }
      }
    }

    // Default code rendering (inline or block)
    // If there's no className, it's inline code
    const isInline = !className;

    if (isInline) {
      return <code className={className} {...props}>{children}</code>;
    }

    // Block code - render in pre
    return (
      <pre className={className}>
        <code {...props}>{children}</code>
      </pre>
    );
  };
}

export function MessageBubble({ role, content, model, timestamp, activities, isStreaming, onUIAction }: MessageBubbleProps) {
  const isUser = role === "user";
  const hasActivities = activities && activities.length > 0;
  const hasContent = content && content.trim().length > 0;

  // Memoize the markdown components to avoid recreation on each render
  const markdownComponents = useMemo<Components>(
    () => ({
      code: createCodeComponent(onUIAction),
      // Wrap pre to prevent double wrapping (code component handles blocks)
      pre: ({ children }) => <>{children}</>,
    }),
    [onUIAction]
  );

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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
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
