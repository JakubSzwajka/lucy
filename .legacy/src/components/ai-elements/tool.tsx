"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/client/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  CircleIcon,
  ClockIcon,
  CopyIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement, useCallback, useState } from "react";

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? (
        <CheckCircleIcon className="size-3" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  );
};

/** Plain JSON code display matching streamdown code block styling */
const JsonBlock = ({ code }: { code: string }) => (
  <pre className="m-0 px-3 py-2.5 text-xs font-mono text-muted-foreground overflow-auto whitespace-pre">
    <code>{code}</code>
  </pre>
);

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

export const getStatusBadge = (status: ToolPart["state"]) => {
  const labels: Record<ToolPart["state"], string> = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "output-available": "Completed",
    "output-error": "Error",
    "output-denied": "Denied",
  };

  const icons: Record<ToolPart["state"], ReactNode> = {
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <ClockIcon className="size-4 animate-pulse" />,
    "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
    "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
    "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
  };

  return (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

const formatToolName = (name: string): string => {
  // Handle MCP tool names like "mcp__uuid__tool_name" -> "tool_name"
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    return parts[parts.length - 1] || name;
  }
  return name;
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const rawName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  const derivedName = formatToolName(rawName);

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground",
        className
      )}
      {...props}
    >
      <ChevronRightIcon className="size-4 shrink-0 transition-transform text-status-online group-data-[state=open]:rotate-90" />
      <span className="font-medium">{title ?? derivedName}</span>
      <div className="h-px flex-1 bg-border" />
      {getStatusBadge(state)}
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-2 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      "flex gap-2 [&>*]:flex-1 [&>*]:min-w-0",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
    <div className="flex items-center justify-between">
      <span className="label-dark">Parameters</span>
      <CopyButton text={JSON.stringify(input, null, 2)} />
    </div>
    <div className="rounded border border-border bg-[hsla(0,0%,4%)] max-h-48 overflow-auto">
      <JsonBlock code={JSON.stringify(input, null, 2)} />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  const outputText =
    typeof output === "object" && !isValidElement(output)
      ? JSON.stringify(output, null, 2)
      : typeof output === "string"
        ? output
        : null;

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <div className="flex items-center justify-between">
        <span className={errorText ? "label-dark text-destructive" : "label-dark"}>
          {errorText ? "Error" : "Result"}
        </span>
        <CopyButton text={errorText || outputText || String(output ?? "")} />
      </div>
      <div
        className={cn(
          "rounded max-h-48 overflow-auto",
          errorText
            ? "border border-destructive/30 bg-destructive/10 text-destructive"
            : "border border-border bg-[hsla(0,0%,4%)]"
        )}
      >
        {errorText && (
          <pre className="m-0 px-3 py-2.5 text-xs font-mono text-destructive whitespace-pre-wrap">
            {errorText}
          </pre>
        )}
        {outputText ? (
          <JsonBlock code={outputText} />
        ) : output && !errorText ? (
          <div className="px-3 py-2.5 text-xs">{output as ReactNode}</div>
        ) : null}
      </div>
    </div>
  );
};
