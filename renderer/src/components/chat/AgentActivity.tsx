"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AgentActivity, ReasoningActivity, ToolCallActivity, ToolResultActivity, StatusActivity } from "@/types";

interface AgentActivitySectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function AgentActivitySection({ title, icon, children, defaultExpanded = false }: AgentActivitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-background/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-background/50 transition-colors"
      >
        <span className={cn(
          "transform transition-transform text-muted",
          isExpanded ? "rotate-90" : "rotate-0"
        )}>
          ▶
        </span>
        <span className="text-muted">{icon}</span>
        <span className="label-dark flex-1 text-left">{title}</span>
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
    <AgentActivitySection title="REASONING" icon="🧠">
      <div className="whitespace-pre-wrap break-words font-mono">
        {activity.content}
      </div>
    </AgentActivitySection>
  );
}

function ToolCallActivityView({ activity }: { activity: ToolCallActivity }) {
  const statusColors: Record<string, string> = {
    pending: "text-yellow-500",
    pending_approval: "text-orange-500 animate-pulse",
    running: "text-blue-400 animate-pulse",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  const statusIcons: Record<string, string> = {
    pending: "⏳",
    pending_approval: "🔐",
    running: "⚡",
    completed: "✓",
    failed: "✗",
  };

  // Build title with server name if available
  const title = activity.serverName
    ? `${activity.toolName} [${activity.serverName}]`
    : activity.toolName;

  return (
    <AgentActivitySection
      title={`TOOL CALL: ${title.toUpperCase()}`}
      icon="🔧"
      defaultExpanded={activity.status === "running" || activity.status === "failed"}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Status:</span>
            <span className={statusColors[activity.status]}>
              {statusIcons[activity.status]} {activity.status}
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
      icon={hasError ? "❌" : "📤"}
      defaultExpanded={hasError}
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
  const statusIcons = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
  };

  return (
    <AgentActivitySection title="STATUS" icon={statusIcons[activity.status]}>
      <div>{activity.message}</div>
    </AgentActivitySection>
  );
}

// Main container component
interface AgentActivityContainerProps {
  activities: AgentActivity[];
  isStreaming?: boolean;
}

export function AgentActivityContainer({ activities, isStreaming }: AgentActivityContainerProps) {
  if (activities.length === 0 && !isStreaming) return null;

  return (
    <div className="max-w-[80%] space-y-2 mb-2">
      {/* Streaming indicator when activities are being generated */}
      {isStreaming && activities.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted px-1">
          <span className="label-dark">// THINKING</span>
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-muted rounded-full animate-bounce" />
            <div className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:100ms]" />
            <div className="w-1 h-1 bg-muted rounded-full animate-bounce [animation-delay:200ms]" />
          </div>
        </div>
      )}

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
  );
}
