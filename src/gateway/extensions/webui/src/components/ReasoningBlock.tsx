import { useState } from "react";
import { BrainCircuit, ChevronRight } from "lucide-react";

import type { ReasoningItem } from "@/api/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  item: ReasoningItem;
}

export function ReasoningBlock({ item }: ReasoningBlockProps) {
  const [open, setOpen] = useState(false);

  // Show a brief preview of the reasoning content
  const preview = item.reasoningSummary
    ?? item.reasoningContent.slice(0, 100).replace(/\n/g, " ") + (item.reasoningContent.length > 100 ? "…" : "");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors",
          "hover:bg-muted/60",
          "text-muted-foreground",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-primary/60" />
        <span className="font-medium font-mono text-foreground/80">Thinking</span>
        {!open && (
          <span className="truncate font-mono text-muted-foreground/60">{preview}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-5 mt-0.5 border-l-2 border-primary/20 pl-3 pb-1">
        <div className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground leading-relaxed max-h-80 overflow-y-auto">
          {item.reasoningContent}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
