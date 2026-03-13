import { useCallback, useEffect, useState } from "react";
import { Circle, Clock, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";

import { getTasks } from "@/api/client";
import type { Task, TaskBoard as TaskBoardType } from "@/api/types";

const COLUMNS = [
  { key: "todo" as const, label: "To Do", icon: Circle, accent: "text-muted-foreground" },
  { key: "in-progress" as const, label: "In Progress", icon: Clock, accent: "text-primary" },
  { key: "done" as const, label: "Done", icon: CheckCircle2, accent: "text-emerald-500" },
];

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{task.updated}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      {task.notes && (
        <p className="text-xs text-muted-foreground leading-relaxed">{task.notes}</p>
      )}
      {task.links && task.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {task.links.map((link) => (
            <span
              key={link}
              className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              {link}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyColumn() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 py-8">
      <span className="text-xs text-muted-foreground/50">No tasks</span>
    </div>
  );
}

export function TaskBoard() {
  const [board, setBoard] = useState<TaskBoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks();
      setBoard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && !board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">Loading tasks…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-destructive-foreground">{error}</span>
      </div>
    );
  }

  const tasks = board?.tasks ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border/50 px-4 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          refresh
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="font-mono text-sm text-muted-foreground">No tasks yet</span>
            <span className="font-mono text-xs text-muted-foreground/50">
              Tasks created by the agent will appear here
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 h-full">
            {COLUMNS.map(({ key, label, icon: Icon, accent }) => {
              const columnTasks = tasks.filter((t) => t.status === key);
              return (
                <div key={key} className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2 pb-3">
                    <Icon className={`h-3.5 w-3.5 ${accent}`} />
                    <span className="font-mono text-xs font-medium uppercase tracking-wider">
                      {label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-auto">
                    {columnTasks.length === 0 ? (
                      <EmptyColumn />
                    ) : (
                      columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
