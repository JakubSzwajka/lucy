"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ComponentProps, ReactNode } from "react";
import { useMemo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Copy, Check } from "lucide-react";

// Code block with copy button
function CodeBlockWithCopy({ className, children }: { className?: string; children: ReactNode }) {
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

// Message container
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, children, ...props }: MessageProps) => {
  const isUser = from === "user";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 w-full",
        isUser ? "items-end" : "items-start",
        className
      )}
      {...props}
    >
      {/* Label */}
      <span className="label-dark mx-1">
        {isUser ? "USER //" : "// LUCY"}
      </span>
      {children}
    </div>
  );
};

// Message content wrapper
export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "max-w-[80%] rounded-lg px-4 py-3 border text-sm leading-relaxed",
      "group-[.is-user]:bg-user-bubble group-[.is-user]:border-user-bubble-border",
      "bg-assistant-bubble border-assistant-bubble-border",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// Markdown renderer component
export type MessageResponseProps = {
  children: string;
  className?: string;
};

export const MessageResponse = ({ children, className }: MessageResponseProps) => {
  const markdownComponents = useMemo<Components>(
    () => ({
      code: function CodeBlock({ className, children, ...props }) {
        const isInline = !className;
        if (isInline) {
          return <code className={className} {...props}>{children}</code>;
        }
        return <CodeBlockWithCopy className={className}>{children}</CodeBlockWithCopy>;
      },
      pre: ({ children }) => <>{children}</>,
    }),
    []
  );

  return (
    <div className={cn("markdown-content break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

// Message actions container
export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

// Message toolbar
export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn(
      "label-sm mx-1 flex items-center gap-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
