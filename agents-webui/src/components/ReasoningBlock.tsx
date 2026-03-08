import { useState } from "react";

import type { ReasoningItem } from "@/api/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ReasoningBlockProps {
  item: ReasoningItem;
}

export function ReasoningBlock({ item }: ReasoningBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted transition-colors">
        <span className="font-mono text-xs">{open ? "\u25BC" : "\u25B6"}</span>
        <span className="font-medium">Reasoning</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded-lg border px-3 py-2">
        <div className="whitespace-pre-wrap font-mono text-sm text-muted-foreground">
          {item.reasoningContent}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
