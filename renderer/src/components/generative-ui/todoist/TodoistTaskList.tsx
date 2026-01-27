"use client";

import { useState } from "react";
import {
  Check,
  Circle,
  Calendar,
  AlertTriangle,
  ExternalLink,
  CalendarClock,
  Loader2,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedTask, TodoistTaskListData, TodoistTaskAction } from "@/lib/generative-ui/todoist/types";
import type { GenerativeUIComponentProps } from "@/lib/generative-ui/registry";

// Priority colors matching Todoist
const priorityColors: Record<number, string> = {
  1: "text-muted-dark", // P4 in Todoist (normal) - mapped to 1 internally
  2: "text-blue-400",   // P3
  3: "text-amber-400",  // P2
  4: "text-red-400",    // P1 (urgent)
};

const priorityLabels: Record<number, string> = {
  1: "P4",
  2: "P3",
  3: "P2",
  4: "P1",
};

interface TaskItemProps {
  task: ParsedTask;
  onAction: (action: TodoistTaskAction) => void;
  isPending: boolean;
}

function TaskItem({ task, onAction, isPending }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDueDate = (task: ParsedTask): string => {
    if (!task.dueDate) return "";

    if (task.isDueToday) return "Today";

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (
      task.dueDate.getDate() === tomorrow.getDate() &&
      task.dueDate.getMonth() === tomorrow.getMonth() &&
      task.dueDate.getFullYear() === tomorrow.getFullYear()
    ) {
      return "Tomorrow";
    }

    // Format as "Jan 27" or "Jan 27 @ 3pm" if has time
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };

    const dateStr = task.dueDate.toLocaleDateString("en-US", options);

    // Check if there's a specific time
    if (task.dueDateString?.includes("T")) {
      const timeStr = task.dueDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} @ ${timeStr}`;
    }

    return dateStr;
  };

  const handleComplete = () => {
    onAction({ type: "complete", taskId: task.id });
  };

  const handleOpenExternal = () => {
    if (task.url) {
      onAction({ type: "open", taskId: task.id, url: task.url });
    }
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 py-2.5 px-3 rounded-md transition-colors",
        isHovered && "bg-background/50",
        task.isCompleted && "opacity-50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={isPending}
        className={cn(
          "mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border transition-all",
          "hover:border-emerald-400 hover:bg-emerald-400/10",
          task.isCompleted
            ? "border-emerald-400 bg-emerald-400/20"
            : "border-muted-dark",
          isPending && "animate-pulse"
        )}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 m-auto animate-spin text-muted" />
        ) : task.isCompleted ? (
          <Check className="w-3 h-3 m-auto text-emerald-400" />
        ) : null}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm leading-tight",
          task.isCompleted && "line-through text-muted"
        )}>
          {task.content}
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-3 mt-1.5 text-xs">
          {/* Due date */}
          {task.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1",
                task.isOverdue && "text-red-400",
                task.isDueToday && !task.isOverdue && "text-amber-400",
                !task.isOverdue && !task.isDueToday && "text-muted"
              )}
            >
              {task.isOverdue ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              {formatDueDate(task)}
              {task.isOverdue && " (overdue)"}
            </span>
          )}

          {/* Priority flag */}
          {task.priority > 1 && (
            <span className={cn("flex items-center gap-1", priorityColors[task.priority])}>
              <Flag className="w-3 h-3" />
              {priorityLabels[task.priority]}
            </span>
          )}

          {/* Project */}
          {task.projectName && (
            <span className="text-muted-dark">
              {task.projectName}
            </span>
          )}

          {/* Labels */}
          {task.labels.length > 0 && (
            <span className="text-muted-dark">
              {task.labels.map((l) => `@${l}`).join(" ")}
            </span>
          )}
        </div>
      </div>

      {/* Actions (visible on hover) */}
      <div
        className={cn(
          "flex items-center gap-1 opacity-0 transition-opacity",
          isHovered && "opacity-100"
        )}
      >
        {task.url && (
          <button
            onClick={handleOpenExternal}
            className="p-1.5 rounded hover:bg-background text-muted hover:text-foreground transition-colors"
            title="Open in Todoist"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          className="p-1.5 rounded hover:bg-background text-muted hover:text-foreground transition-colors"
          title="Reschedule"
        >
          <CalendarClock className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TodoistTaskList({
  data,
  onAction,
  isActionPending,
}: GenerativeUIComponentProps<TodoistTaskListData>) {
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<ParsedTask[]>(data.tasks);

  const handleTaskAction = async (action: TodoistTaskAction) => {
    if (action.type === "open" && action.url) {
      // Open external link
      window.open(action.url, "_blank");
      return;
    }

    if (action.type === "complete") {
      setPendingTaskId(action.taskId);

      // Optimistic update
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === action.taskId ? { ...t, isCompleted: !t.isCompleted } : t
        )
      );

      // Call the action handler (mocked for now)
      if (onAction) {
        try {
          await onAction("complete_task", { taskId: action.taskId });
        } catch (error) {
          // Revert on error
          setLocalTasks((prev) =>
            prev.map((t) =>
              t.id === action.taskId ? { ...t, isCompleted: !t.isCompleted } : t
            )
          );
        }
      }

      setPendingTaskId(null);
    }
  };

  const overdueCount = localTasks.filter((t) => t.isOverdue && !t.isCompleted).length;
  const todayCount = localTasks.filter((t) => t.isDueToday && !t.isCompleted).length;
  const completedCount = localTasks.filter((t) => t.isCompleted).length;

  // Sort: overdue first, then today, then by due date
  const sortedTasks = [...localTasks].sort((a, b) => {
    // Completed tasks at the end
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    // Overdue first
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    // Today next
    if (a.isDueToday !== b.isDueToday) return a.isDueToday ? -1 : 1;
    // Then by due date
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  return (
    <div className="my-3 border border-border rounded-lg overflow-hidden bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-red-400" fill="currentColor" />
          <span className="label-dark">TODOIST TASKS</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} overdue
            </span>
          )}
          {todayCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Calendar className="w-3 h-3" />
              {todayCount} today
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3" />
              {completedCount} done
            </span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="divide-y divide-border/30">
        {sortedTasks.length === 0 ? (
          <div className="py-6 text-center text-muted text-sm">
            No tasks found
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onAction={handleTaskAction}
              isPending={pendingTaskId === task.id || !!isActionPending}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {data.filter && (
        <div className="px-3 py-2 border-t border-border/50 bg-background/30">
          <span className="label-sm">Filter: {data.filter}</span>
        </div>
      )}
    </div>
  );
}
