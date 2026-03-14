import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

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
                const match = /language-(\w+)/.exec(className || "");
                const language = match?.[1];
                if (language) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={language}
                      PreTag="div"
                      customStyle={{
                        margin: "0.5rem 0",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  );
                }
                return (
                  <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
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
              h1: ({ children }) => (
                <h1 className="mb-3 mt-4 text-lg font-bold first:mt-0">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h3>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-3 border-border" />,
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic">{children}</em>
              ),
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="border-b border-border">{children}</thead>
              ),
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => (
                <tr className="border-b border-border/50 last:border-0">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-3 py-1.5 text-left font-semibold text-foreground">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-1.5 text-muted-foreground">{children}</td>
              ),
            }}
          >
            {item.content}
          </Markdown>
        )}
      </div>
    </div>
  );
}
