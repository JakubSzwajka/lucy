"use client";

import { cn } from "@/lib/utils";
import {
  Wrench,
  ChevronRight,
  Clock,
  ShieldAlert,
  Zap,
  Check,
  X,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { useState } from "react";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  state: ToolState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  defaultOpen?: boolean;
};

const statusConfig: Record<ToolState, {
  label: string;
  color: string;
  icon: ReactNode;
  variant: "default" | "success" | "error";
}> = {
  "input-streaming": {
    label: "Pending",
    color: "text-yellow-500",
    icon: <Clock className="w-3 h-3" />,
    variant: "default",
  },
  "input-available": {
    label: "Running",
    color: "text-blue-400 animate-pulse",
    icon: <Zap className="w-3 h-3" />,
    variant: "default",
  },
  "approval-requested": {
    label: "Awaiting Approval",
    color: "text-orange-500 animate-pulse",
    icon: <ShieldAlert className="w-3 h-3" />,
    variant: "default",
  },
  "approval-responded": {
    label: "Responded",
    color: "text-blue-400",
    icon: <Check className="w-3 h-3" />,
    variant: "default",
  },
  "output-available": {
    label: "Completed",
    color: "text-emerald-400",
    icon: <Check className="w-3 h-3" />,
    variant: "success",
  },
  "output-error": {
    label: "Error",
    color: "text-red-400",
    icon: <X className="w-3 h-3" />,
    variant: "error",
  },
  "output-denied": {
    label: "Denied",
    color: "text-orange-400",
    icon: <X className="w-3 h-3" />,
    variant: "error",
  },
};

const variantStyles = {
  default: "border-border/50 bg-background/30",
  success: "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-emerald-400/5",
  error: "border-red-500/40 bg-gradient-to-r from-red-500/10 to-red-400/5",
};

export function Tool({
  className,
  name,
  state,
  input,
  output,
  errorText,
  defaultOpen = false,
  ...props
}: ToolProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = statusConfig[state];

  // Check if output contains an error
  const outputContainsError = (() => {
    if (!output) return false;
    try {
      const parsed = typeof output === "string" ? JSON.parse(output) : output;
      return parsed && typeof parsed === "object" && "error" in parsed;
    } catch {
      return false;
    }
  })();

  const hasError = !!errorText || outputContainsError;
  const effectiveVariant = hasError && state === "output-available" ? "error" : config.variant;
  const hasInput = input !== undefined && Object.keys(input).length > 0;
  const hasOutput = output !== undefined;

  const formatOutput = (data: unknown): string => {
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        variantStyles[effectiveVariant],
        className
      )}
      {...props}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background/50 transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transform transition-transform text-muted",
            isOpen && "rotate-90"
          )}
        />
        <span className={cn("text-muted", effectiveVariant === "error" && "text-red-400", effectiveVariant === "success" && "text-emerald-400")}>
          <Wrench className="w-3.5 h-3.5" />
        </span>
        <span className={cn(
          "flex-1 text-left label-dark",
          effectiveVariant === "success" && "text-emerald-400",
          effectiveVariant === "error" && "text-red-400"
        )}>
          TOOL: {name.toUpperCase()}
        </span>
        <span className={cn("flex items-center gap-1 text-xs", config.color)}>
          {config.icon}
          <span className="uppercase">{config.label}</span>
        </span>
      </button>

      {isOpen && (
        <div className="px-3 py-2 border-t border-border/30 text-xs text-muted-dark leading-relaxed space-y-2">
          {/* Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Status:</span>
              <span className={cn("flex items-center gap-1", config.color)}>
                {config.icon} {config.label}
              </span>
            </div>
          </div>

          {/* Arguments */}
          {hasInput && (
            <div>
              <span className="text-muted block mb-1">Arguments:</span>
              <pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {errorText && (
            <div>
              <span className="text-muted block mb-1">Error:</span>
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-400 text-xs">
                {errorText}
              </div>
            </div>
          )}

          {/* Result */}
          {hasOutput && !errorText && (
            <div>
              <span className="text-muted block mb-1">
                {outputContainsError ? "Error:" : "Result:"}
              </span>
              <pre className={cn(
                "rounded p-2 overflow-x-auto whitespace-pre-wrap text-xs font-mono max-h-48",
                outputContainsError
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-background/50"
              )}>
                {formatOutput(output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
