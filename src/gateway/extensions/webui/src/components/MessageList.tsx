import { useEffect, useRef } from "react";

import type { Item, ToolResultItem } from "@/api/types";
import { MessageBubble } from "@/components/MessageBubble";
import { ReasoningBlock } from "@/components/ReasoningBlock";
import { ToolCallBlock } from "@/components/ToolCallBlock";
import { ActivityGroup } from "@/components/ActivityGroup";

interface MessageListProps {
  items: Item[];
}

/**
 * Determines if an item is an "activity" item (tool call, tool result, or reasoning)
 * that should be grouped between messages.
 */
function isActivityItem(item: Item): boolean {
  return item.type === "tool_call" || item.type === "tool_result" || item.type === "reasoning";
}

/**
 * Groups consecutive activity items together so they render as a single
 * collapsible cluster rather than individual noisy blocks.
 */
function buildRenderGroups(sorted: Item[]): Array<{ kind: "message"; item: Item } | { kind: "activity"; items: Item[] }> {
  const groups: Array<{ kind: "message"; item: Item } | { kind: "activity"; items: Item[] }> = [];
  let currentActivity: Item[] = [];

  function flushActivity() {
    if (currentActivity.length > 0) {
      groups.push({ kind: "activity", items: currentActivity });
      currentActivity = [];
    }
  }

  for (const item of sorted) {
    if (isActivityItem(item)) {
      currentActivity.push(item);
    } else {
      flushActivity();
      groups.push({ kind: "message", item });
    }
  }
  flushActivity();

  return groups;
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

  const groups = buildRenderGroups(sorted);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="flex flex-1 flex-col gap-3">
        {groups.map((group, idx) => {
          if (group.kind === "message") {
            return <MessageBubble key={group.item.id} item={group.item} />;
          }
          // Activity group
          const key = group.items.map((i) => i.id).join("-");
          return (
            <ActivityGroup
              key={key}
              items={group.items}
              toolResultsByCallId={toolResultsByCallId}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
