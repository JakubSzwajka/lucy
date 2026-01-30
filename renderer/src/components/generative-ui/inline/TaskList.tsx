"use client";

import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskListProps, TaskItem } from "@/lib/generative-ui/inline/registry";
import type { InlineUIBaseProps } from "@/lib/generative-ui/inline/types";

interface TaskItemRowProps {
  task: TaskItem;
  onToggle: (id: string, completed: boolean) => void;
}

function TaskItemRow({ task, onToggle }: TaskItemRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onToggle(task.id, task.completed);
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 py-2.5 px-3 rounded-md transition-colors",
        isHovered && "bg-background/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={handleClick}
        className={cn(
          "mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border transition-all",
          "hover:border-emerald-400 hover:bg-emerald-400/10",
          task.completed
            ? "border-emerald-400 bg-emerald-400/20"
            : "border-muted-dark"
        )}
      >
        {task.completed && (
          <Check className="w-3 h-3 m-auto text-emerald-400" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm leading-tight",
            task.completed && "line-through text-muted"
          )}
        >
          {task.text}
        </div>
      </div>
    </div>
  );
}

export function TaskList({
  items,
  onAction,
}: TaskListProps & InlineUIBaseProps) {
  const [localItems, setLocalItems] = useState<TaskItem[]>(items);

  const handleToggle = (id: string, currentCompleted: boolean) => {
    // Update local state
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !currentCompleted } : item
      )
    );

    // Log the action
    console.log("[TaskList] Toggle task:", {
      id,
      previousCompleted: currentCompleted,
      newCompleted: !currentCompleted,
    });

    // Call the action handler if provided
    if (onAction) {
      onAction("toggle_task", { id, completed: !currentCompleted });
    }
  };

  const completedCount = localItems.filter((item) => item.completed).length;
  const totalCount = localItems.length;

  return (
    <div className="my-3 border border-border rounded-lg overflow-hidden bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/50">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-blue-400" fill="currentColor" />
          <span className="label-dark">TASKS</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {completedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3" />
              {completedCount}/{totalCount}
            </span>
          )}
          {completedCount === 0 && (
            <span>{totalCount} tasks</span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="divide-y divide-border/30">
        {localItems.length === 0 ? (
          <div className="py-6 text-center text-muted text-sm">
            No tasks
          </div>
        ) : (
          localItems.map((task) => (
            <TaskItemRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}
