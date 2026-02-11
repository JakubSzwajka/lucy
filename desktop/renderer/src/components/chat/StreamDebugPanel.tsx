"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BugIcon, XIcon, Trash2Icon } from "lucide-react";
import type { StreamEvent } from "@/hooks/useStreamEvents";

// ============================================================================
// Types
// ============================================================================

interface StreamDebugPanelProps {
  events: StreamEvent[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const TYPE_STYLES: Record<StreamEvent["type"], string> = {
  text: "bg-muted text-muted-foreground",
  reasoning: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "tool-call": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "tool-result": "bg-green-500/20 text-green-400 border-green-500/30",
  "stream-start": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "stream-end": "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function formatTimestamp(timestamp: Date): string {
  const d = timestamp;
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

// ============================================================================
// Event Row
// ============================================================================

function EventRow({ event }: { event: StreamEvent }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-b border-border/50 text-xs hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono shrink-0">
          {formatTimestamp(event.timestamp)}
        </span>
        <Badge
          variant="outline"
          className={cn("text-[10px] px-1.5 py-0 h-4 font-mono", TYPE_STYLES[event.type])}
        >
          {event.type}
        </Badge>
      </div>
      <p className="text-foreground/90 truncate">{event.summary}</p>
      {event.detail && (
        <p className="text-muted-foreground truncate">{event.detail}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StreamDebugPanel({
  events,
  onClear,
  isOpen,
  onToggle,
}: StreamDebugPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [events.length]);

  // Collapsed tab on right edge
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 bg-muted/80 hover:bg-muted border border-r-0 border-border rounded-l-md px-1.5 py-3 transition-colors cursor-pointer"
      >
        <BugIcon className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium [writing-mode:vertical-lr]">
          Events
        </span>
        {events.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[9px] px-1 py-0 h-3.5 min-w-0"
          >
            {events.length}
          </Badge>
        )}
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="w-80 border-l border-border bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BugIcon className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Stream Events</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {events.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            title="Clear events"
          >
            <Trash2Icon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggle}
            title="Close panel"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Event list */}
      <ScrollArea ref={scrollRef} className="flex-1">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            No events yet
          </div>
        ) : (
          <div>
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
