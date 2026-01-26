"use client";

import { useState } from "react";
import {
  Brain,
  Wrench,
  ChevronRight,
  Clock,
  ShieldAlert,
  Zap,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  PackageOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentActivity, ReasoningActivity, ToolCallActivity, ToolResultActivity, StatusActivity } from "@/types";

interface AgentActivitySectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: "default" | "success" | "error";
}

function AgentActivitySection({
  title,
  icon,
  children,
  defaultExpanded = false,
  variant = "default"
}: AgentActivitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const variantStyles = {
    default: "border-border/50 bg-background/30",
    success: "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-emerald-400/5",
    error: "border-red-500/40 bg-gradient-to-r from-red-500/10 to-red-400/5",
  };

  const titleStyles = {
    default: "label-dark",
    success: "text-emerald-400",
    error: "text-red-400",
  };

  return (
    <div className={cn("border rounded-lg overflow-hidden", variantStyles[variant])}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background/50 transition-colors"
      >
        <ChevronRight className={cn(
          "w-3 h-3 transform transition-transform text-muted",
          isExpanded && "rotate-90"
        )} />
        <span className={cn("text-muted", variant === "error" && "text-red-400", variant === "success" && "text-emerald-400")}>
          {icon}
        </span>
        <span className={cn("flex-1 text-left", titleStyles[variant])}>{title}</span>
      </button>
      {isExpanded && (
        <div className="px-3 py-2 border-t border-border/30 text-xs text-muted-dark leading-relaxed max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// Individual activity renderers
function ReasoningActivityView({ activity }: { activity: ReasoningActivity }) {
  return (
    <AgentActivitySection title="REASONING" icon={<Brain className="w-3.5 h-3.5" />}>
      <div className="whitespace-pre-wrap break-words font-mono">
        {activity.content}
      </div>
    </AgentActivitySection>
  );
}

function ToolCallActivityView({ activity }: { activity: ToolCallActivity }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; variant: "default" | "success" | "error" }> = {
    pending: {
      color: "text-yellow-500",
      icon: <Clock className="w-3 h-3" />,
      variant: "default"
    },
    pending_approval: {
      color: "text-orange-500 animate-pulse",
      icon: <ShieldAlert className="w-3 h-3" />,
      variant: "default"
    },
    running: {
      color: "text-blue-400 animate-pulse",
      icon: <Zap className="w-3 h-3" />,
      variant: "default"
    },
    completed: {
      color: "text-emerald-400",
      icon: <Check className="w-3 h-3" />,
      variant: "success"
    },
    failed: {
      color: "text-red-400",
      icon: <X className="w-3 h-3" />,
      variant: "error"
    },
  };

  const config = statusConfig[activity.status] || statusConfig.pending;

  // Build title with server name if available
  const title = activity.serverName
    ? `${activity.toolName} [${activity.serverName}]`
    : activity.toolName;

  return (
    <AgentActivitySection
      title={`TOOL CALL: ${title.toUpperCase()}`}
      icon={<Wrench className="w-3.5 h-3.5" />}
      defaultExpanded={activity.status === "running" || activity.status === "failed"}
      variant={config.variant}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Status:</span>
            <span className={cn("flex items-center gap-1", config.color)}>
              {config.icon} {activity.status}
            </span>
          </div>
          {activity.executionTimeMs && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Time:</span>
              <span className="text-muted-dark">{activity.executionTimeMs}ms</span>
            </div>
          )}
        </div>
        {activity.args && Object.keys(activity.args).length > 0 && (
          <div>
            <span className="text-muted block mb-1">Arguments:</span>
            <pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono">
              {JSON.stringify(activity.args, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </AgentActivitySection>
  );
}

function ToolResultActivityView({ activity }: { activity: ToolResultActivity }) {
  const hasError = !!activity.error;
  const hasResult = activity.result !== undefined && activity.result !== null;

  // Format result for display
  const formatResult = (result: unknown): string => {
    if (typeof result === "string") {
      // Try to parse as JSON for pretty printing
      try {
        const parsed = JSON.parse(result);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return result;
      }
    }
    return JSON.stringify(result, null, 2);
  };

  return (
    <AgentActivitySection
      title={hasError ? "TOOL ERROR" : "TOOL RESULT"}
      icon={hasError ? <AlertCircle className="w-3.5 h-3.5" /> : <PackageOpen className="w-3.5 h-3.5" />}
      defaultExpanded={hasError}
      variant={hasError ? "error" : "default"}
    >
      <div className="space-y-2">
        {hasError ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-400">
            {activity.error}
          </div>
        ) : hasResult ? (
          <pre className="bg-background/50 rounded p-2 overflow-x-auto whitespace-pre-wrap text-xs font-mono max-h-48">
            {formatResult(activity.result)}
          </pre>
        ) : (
          <span className="text-muted-dark italic">No output</span>
        )}
      </div>
    </AgentActivitySection>
  );
}

function StatusActivityView({ activity }: { activity: StatusActivity }) {
  const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "success" | "error" }> = {
    info: { icon: <Info className="w-3.5 h-3.5" />, variant: "default" },
    success: { icon: <CheckCircle className="w-3.5 h-3.5" />, variant: "success" },
    warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, variant: "default" },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, variant: "error" },
  };

  const config = statusConfig[activity.status] || statusConfig.info;

  return (
    <AgentActivitySection
      title="STATUS"
      icon={config.icon}
      variant={config.variant}
    >
      <div>{activity.message}</div>
    </AgentActivitySection>
  );
}

// Helper to get the latest activity label
function getLatestActivityLabel(activities: AgentActivity[]): string {
  if (activities.length === 0) return "Thinking...";

  const latest = activities[activities.length - 1];
  switch (latest.type) {
    case "reasoning":
      return "Reasoning...";
    case "tool_call": {
      const toolCall = latest as ToolCallActivity;
      const toolLabel = toolCall.serverName
        ? `${toolCall.toolName} [${toolCall.serverName}]`
        : toolCall.toolName;
      return toolCall.status === "running" || toolCall.status === "pending"
        ? `Calling ${toolLabel}...`
        : `Called ${toolLabel}`;
    }
    case "tool_result":
      return "Processing result...";
    case "status":
      return (latest as StatusActivity).message;
    default:
      return "Working...";
  }
}

// Check if all activities are completed
function isAllCompleted(activities: AgentActivity[]): boolean {
  if (activities.length === 0) return false;

  const hasActiveToolCall = activities.some(
    a => a.type === "tool_call" &&
    ((a as ToolCallActivity).status === "running" || (a as ToolCallActivity).status === "pending")
  );

  return !hasActiveToolCall;
}

// Main container component
interface AgentActivityContainerProps {
  activities: AgentActivity[];
  isStreaming?: boolean;
}

export function AgentActivityContainer({ activities, isStreaming }: AgentActivityContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (activities.length === 0 && !isStreaming) return null;

  const isDone = !isStreaming && isAllCompleted(activities);
  const latestLabel = isDone ? "Done" : getLatestActivityLabel(activities);

  return (
    <div className="max-w-[80%] mb-2">
      {/* Outer collapsible wrapper */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-background/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background/50 transition-colors"
        >
          <ChevronRight className={cn(
            "w-3 h-3 transform transition-transform text-muted",
            isExpanded && "rotate-90"
          )} />
          <Brain className={cn(
            "w-4 h-4",
            isDone ? "text-emerald-400" : "text-purple-400",
            !isDone && "animate-pulse"
          )} />
          <span className={cn(
            "flex-1 text-left",
            isDone ? "text-emerald-400" : "text-muted-dark"
          )}>
            {latestLabel}
          </span>
          {isDone && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </span>
          )}
          {!isDone && isStreaming && (
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:100ms]" />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:200ms]" />
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="px-3 py-2 border-t border-border/30 space-y-2">
            {/* Render each activity */}
            {activities.map((activity) => {
              switch (activity.type) {
                case "reasoning":
                  return <ReasoningActivityView key={activity.id} activity={activity} />;
                case "tool_call":
                  return <ToolCallActivityView key={activity.id} activity={activity} />;
                case "tool_result":
                  return <ToolResultActivityView key={activity.id} activity={activity} />;
                case "status":
                  return <StatusActivityView key={activity.id} activity={activity} />;
                default:
                  return null;
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
