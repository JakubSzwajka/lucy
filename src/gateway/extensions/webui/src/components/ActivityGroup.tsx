import { useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";

import type { Item, ToolCallItem, ToolResultItem, ReasoningItem } from "@/api/types";
import { ToolCallBlock } from "@/components/ToolCallBlock";
import { ReasoningBlock } from "@/components/ReasoningBlock";
import { cn } from "@/lib/utils";

interface ActivityGroupProps {
  items: Item[];
  toolResultsByCallId: Map<string, ToolResultItem>;
}

/**
 * Groups consecutive tool_call / tool_result / reasoning items into a
 * collapsible "activity" block that gives a quick overview of what the
 * agent did between two messages.
 */
export function ActivityGroup({ items, toolResultsByCallId }: ActivityGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const toolCalls = items.filter((i): i is ToolCallItem => i.type === "tool_call");
  const reasonings = items.filter((i): i is ReasoningItem => i.type === "reasoning");
  const totalSteps = toolCalls.length + reasonings.length;

  const failedCount = toolCalls.filter((t) => t.toolStatus === "failed").length;
  const pendingCount = toolCalls.filter(
    (t) => t.toolStatus !== "completed" && t.toolStatus !== "failed",
  ).length;

  // Build a concise summary line
  const parts: string[] = [];
  if (toolCalls.length > 0) {
    parts.push(`${toolCalls.length} tool call${toolCalls.length > 1 ? "s" : ""}`);
  }
  if (reasonings.length > 0) {
    parts.push(`${reasonings.length} reasoning`);
  }
  const summary = parts.join(", ");

  // For a single item, just render it inline — no grouping needed
  if (totalSteps === 1) {
    const item = items.find(
      (i) => i.type === "tool_call" || i.type === "reasoning",
    )!;
    if (item.type === "tool_call") {
      return (
        <ToolCallBlock
          toolCall={item as ToolCallItem}
          toolResult={toolResultsByCallId.get((item as ToolCallItem).callId)}
        />
      );
    }
    return <ReasoningBlock item={item as ReasoningItem} />;
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors",
          "hover:bg-muted/40",
        )}
      >
        <Activity className="h-3.5 w-3.5 shrink-0 text-primary/50" />
        <span className="font-mono font-medium text-foreground/70">Activity</span>
        <span className="font-mono text-muted-foreground/70">{summary}</span>
        {failedCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
            {failedCount} failed
          </span>
        )}
        {pendingCount > 0 && (
          <span className="rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
            {pendingCount} running
          </span>
        )}
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      </button>

      {/* Expanded: show all items */}
      {expanded && (
        <div className="border-t border-border/30 px-1 py-1 space-y-0.5">
          {items.map((item) => {
            if (item.type === "tool_call") {
              return (
                <ToolCallBlock
                  key={item.id}
                  toolCall={item}
                  toolResult={toolResultsByCallId.get(item.callId)}
                />
              );
            }
            if (item.type === "reasoning") {
              return <ReasoningBlock key={item.id} item={item} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
