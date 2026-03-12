import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Terminal,
  FileText,
  Search,
  Globe,
  Pencil,
  FolderOpen,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { ToolCallItem, ToolResultItem } from "@/api/types";
import { cn } from "@/lib/utils";

interface ToolCallBlockProps {
  toolCall: ToolCallItem;
  toolResult?: ToolResultItem;
}

/** Map well-known tool names to icons and extract a human-readable summary. */
function getToolMeta(toolCall: ToolCallItem): {
  icon: React.ReactNode;
  label: string;
  detail: string;
} {
  const name = toolCall.toolName.toLowerCase();
  const args = toolCall.toolArgs ?? {};
  const iconClass = "h-3.5 w-3.5 shrink-0";

  // Bash / shell / exec commands
  if (name === "bash" || name === "execute" || name === "shell" || name === "run_command") {
    const cmd = (args.command ?? args.cmd ?? "") as string;
    const short = cmd.length > 120 ? cmd.slice(0, 117) + "…" : cmd;
    return {
      icon: <Terminal className={iconClass} />,
      label: "Terminal",
      detail: short || "Running command…",
    };
  }

  // File read
  if (name === "read" || name === "read_file" || name === "cat") {
    const path = (args.path ?? args.file ?? "") as string;
    return {
      icon: <FileText className={iconClass} />,
      label: "Read",
      detail: path || "Reading file…",
    };
  }

  // File write / edit
  if (
    name === "write" ||
    name === "write_file" ||
    name === "edit" ||
    name === "edit_file" ||
    name === "patch"
  ) {
    const path = (args.path ?? args.file ?? "") as string;
    return {
      icon: <Pencil className={iconClass} />,
      label: name.startsWith("edit") ? "Edit" : "Write",
      detail: path || "Modifying file…",
    };
  }

  // Search / grep
  if (name === "search" || name === "grep" || name === "ripgrep" || name === "find") {
    const query = (args.query ?? args.pattern ?? args.regex ?? "") as string;
    return {
      icon: <Search className={iconClass} />,
      label: "Search",
      detail: query || "Searching…",
    };
  }

  // Directory listing
  if (name === "ls" || name === "list_directory" || name === "list_files") {
    const path = (args.path ?? args.dir ?? ".") as string;
    return {
      icon: <FolderOpen className={iconClass} />,
      label: "List",
      detail: path,
    };
  }

  // Web / fetch / browse
  if (
    name === "fetch" ||
    name === "browse" ||
    name === "web" ||
    name === "http" ||
    name.includes("url")
  ) {
    const url = (args.url ?? args.href ?? "") as string;
    return {
      icon: <Globe className={iconClass} />,
      label: "Web",
      detail: url || "Fetching…",
    };
  }

  // Fallback: show tool name + first string arg as detail
  const firstStringArg = Object.values(args).find((v) => typeof v === "string") as
    | string
    | undefined;
  return {
    icon: <Wrench className={iconClass} />,
    label: toolCall.toolName,
    detail: firstStringArg
      ? firstStringArg.length > 100
        ? firstStringArg.slice(0, 97) + "…"
        : firstStringArg
      : "",
  };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />;
  }
  if (status === "failed") {
    return <XCircle className="h-3.5 w-3.5 text-destructive-foreground shrink-0" />;
  }
  return <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />;
}

export function ToolCallBlock({ toolCall, toolResult }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const { icon, label, detail } = getToolMeta(toolCall);
  const hasContent =
    (toolCall.toolArgs && Object.keys(toolCall.toolArgs).length > 0) || toolResult;

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
        <span className="text-foreground/70">{icon}</span>
        <span className="font-medium font-mono text-foreground/80">{label}</span>
        {detail && (
          <span className="truncate font-mono text-muted-foreground/80">{detail}</span>
        )}
        <span className="ml-auto">
          <StatusIcon status={toolCall.toolStatus} />
        </span>
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent className="ml-5 mt-0.5 border-l-2 border-border/50 pl-3 pb-1">
          {toolCall.toolArgs && Object.keys(toolCall.toolArgs).length > 0 && (
            <div className="mb-1.5">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Args
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] text-foreground/70 leading-relaxed">
                {JSON.stringify(toolCall.toolArgs, null, 2)}
              </pre>
            </div>
          )}
          {toolResult && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Result
              </p>
              {toolResult.toolError ? (
                <pre className="overflow-x-auto rounded-md bg-destructive/5 border border-destructive/10 px-2.5 py-1.5 font-mono text-[11px] text-destructive-foreground leading-relaxed max-h-60 overflow-y-auto">
                  {toolResult.toolError}
                </pre>
              ) : (
                <pre className="overflow-x-auto rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] text-foreground/70 leading-relaxed max-h-60 overflow-y-auto">
                  {toolResult.toolOutput ?? "No output"}
                </pre>
              )}
            </div>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
