import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ToolCallItem, ToolResultItem } from "@/api/types";
import { cn } from "@/lib/utils";

interface ToolCallBlockProps {
  toolCall: ToolCallItem;
  toolResult?: ToolResultItem;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-destructive"
        : "bg-yellow-500";

  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} />;
}

export function ToolCallBlock({ toolCall, toolResult }: ToolCallBlockProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-mono hover:bg-muted transition-colors">
        <StatusDot status={toolCall.toolStatus} />
        <span className="font-medium">{toolCall.toolName}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {toolCall.toolStatus}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded-lg border px-3 py-2">
        {toolCall.toolArgs && Object.keys(toolCall.toolArgs).length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Arguments
            </p>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
              {JSON.stringify(toolCall.toolArgs, null, 2)}
            </pre>
          </div>
        )}
        {toolResult && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Result
            </p>
            {toolResult.toolError ? (
              <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs text-destructive">
                {toolResult.toolError}
              </pre>
            ) : (
              <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                {toolResult.toolOutput ?? "No output"}
              </pre>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
