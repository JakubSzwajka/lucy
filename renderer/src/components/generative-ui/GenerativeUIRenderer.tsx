"use client";

import { useState, useMemo } from "react";
import { getGenerativeUI } from "@/lib/generative-ui/registry";
import type { ToolCallActivity } from "@/types";

interface GenerativeUIRendererProps {
  /** Tool call activities from the message */
  activities: ToolCallActivity[];
  /** Optional callback for handling actions from components */
  onAction?: (toolName: string, action: string, payload: unknown) => Promise<void>;
}

/**
 * Renders generative UI components for tool calls that have registered components.
 * Filters activities to only those with completed results and matching components.
 */
export function GenerativeUIRenderer({ activities, onAction }: GenerativeUIRendererProps) {
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  // Filter to tool calls that have results and registered generative UI
  const renderableActivities = useMemo(() => {
    const filtered = activities.filter((activity) => {
      // Must be a completed tool call with a result
      if (activity.status !== "completed" || !activity.result) {
        console.log("[Generative UI] Skipping activity (not completed or no result):", activity.toolName, activity.status);
        return false;
      }
      // Must have a registered generative UI component
      const hasUI = getGenerativeUI(activity.toolName) !== null;
      console.log("[Generative UI] Tool:", activity.toolName, "hasGenerativeUI:", hasUI);
      return hasUI;
    });
    console.log("[Generative UI] Renderable activities:", filtered.length);
    return filtered;
  }, [activities]);

  if (renderableActivities.length === 0) {
    return null;
  }

  const handleAction = async (
    activity: ToolCallActivity,
    action: string,
    payload: unknown
  ) => {
    const actionKey = `${activity.callId}-${action}`;
    setPendingActions((prev) => new Set(prev).add(actionKey));

    try {
      if (onAction) {
        await onAction(activity.toolName, action, payload);
      }
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {renderableActivities.map((activity) => {
        const config = getGenerativeUI(activity.toolName);
        if (!config || !activity.result) return null;

        const Component = config.component;
        let parsedData: unknown;

        try {
          parsedData = config.parseResult(activity.result);
        } catch (error) {
          console.error(
            `Failed to parse result for ${activity.toolName}:`,
            error
          );
          return null;
        }

        const isAnyActionPending = Array.from(pendingActions).some((key) =>
          key.startsWith(activity.callId)
        );

        return (
          <Component
            key={activity.callId}
            data={parsedData}
            activity={activity}
            onAction={(action, payload) => handleAction(activity, action, payload)}
            isActionPending={isAnyActionPending}
          />
        );
      })}
    </div>
  );
}
