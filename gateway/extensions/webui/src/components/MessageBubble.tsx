import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { MessageItem } from "@/api/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  item: MessageItem;
}

export function MessageBubble({ item }: MessageBubbleProps) {
  if (item.role === "system") {
    return null;
  }

  const isUser = item.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary/15 border border-primary/25 text-foreground font-sans"
            : "bg-card border border-border font-sans",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{item.content}</p>
        ) : (
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <pre className="my-2 overflow-x-auto rounded bg-background p-3 font-mono text-sm">
                    <code>{children}</code>
                  </pre>
                ) : (
                  <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm">
                    {children}
                  </code>
                );
              },
              p: ({ children }) => (
                <p className="mb-2 last:mb-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 list-disc pl-4">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 list-decimal pl-4">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
            }}
          >
            {item.content}
          </Markdown>
        )}
      </div>
    </div>
  );
}
