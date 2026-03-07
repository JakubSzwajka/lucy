import { useEffect, useRef } from "react";

import type { Item, ToolResultItem } from "@/api/types";
import { MessageBubble } from "@/components/MessageBubble";
import { ToolCallBlock } from "@/components/ToolCallBlock";

interface MessageListProps {
  items: Item[];
}

export function MessageList({ items }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const sorted = [...items].sort((a, b) => a.sequence - b.sequence);

  // Build a lookup of tool results by callId for pairing with tool calls
  const toolResultsByCallId = new Map<string, ToolResultItem>();
  for (const item of sorted) {
    if (item.type === "tool_result") {
      toolResultsByCallId.set(item.callId, item);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="flex flex-1 flex-col gap-3">
        {sorted.map((item) => {
          switch (item.type) {
            case "message":
              return <MessageBubble key={item.id} item={item} />;
            case "tool_call":
              return (
                <ToolCallBlock
                  key={item.id}
                  toolCall={item}
                  toolResult={toolResultsByCallId.get(item.callId)}
                />
              );
            case "tool_result":
            case "reasoning":
              return null;
            default:
              return null;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
