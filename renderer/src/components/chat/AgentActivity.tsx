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
    pending: "text-muted",
    running: "text-accent",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  return (
    <AgentActivitySection title={`TOOL: ${activity.toolName.toUpperCase()}`} icon="🔧">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-muted">Status:</span>
          <span className={statusColors[activity.status]}>{activity.status}</span>
        </div>
        {activity.args && (
          <div>
            <span className="text-muted block mb-1">Arguments:</span>
            <pre className="bg-background/50 rounded p-2 overflow-x-auto">
              {JSON.stringify(activity.args, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </AgentActivitySection>
  );
}

function ToolResultActivityView({ activity }: { activity: ToolResultActivity }) {
  return (
    <AgentActivitySection title="TOOL RESULT" icon="📤">
      <div className="space-y-2">
        {activity.error ? (
          <div className="text-red-500">Error: {activity.error}</div>
        ) : (
          <pre className="bg-background/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
            {typeof activity.result === "string"
              ? activity.result
              : JSON.stringify(activity.result, null, 2)}
          </pre>
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
