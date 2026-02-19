"use client";

import { useMemo } from "react";
import { StatsTab } from "@/components/memory/StatsTab";
import { useTriggers } from "@/hooks/useTriggers";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import type { Trigger } from "@/types";

function getNextRuns(trigger: Trigger, count: number): Date[] {
  if (trigger.triggerType !== "cron" || !trigger.cronExpression) return [];
  try {
    const interval = CronExpressionParser.parse(trigger.cronExpression, {
      tz: trigger.timezone || "UTC",
    });
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(interval.next().toDate());
    }
    return dates;
  } catch {
    return [];
  }
}

function getCronDescription(expr: string): string {
  try {
    return cronstrue.toString(expr);
  } catch {
    return expr;
  }
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff < 0) return "now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const cards = [
  {
    label: "ACTIVE_SESSIONS",
    title: "Active Sessions",
    value: "3",
    description: "Running conversations",
  },
  {
    label: "MODELS",
    title: "Models",
    value: "5",
    description: "Available AI models",
  },
  {
    label: "RECENT_ACTIVITY",
    title: "Recent Activity",
    value: "12",
    description: "Messages today",
  },
  {
    label: "SYS_STATUS",
    title: "System Status",
    value: "OK",
    description: "All systems operational",
  },
];

export default function DashboardPage() {
  const { triggers } = useTriggers();
  const { configs } = useAgentConfigs();

  const cronTriggers = triggers.filter((t) => t.triggerType === "cron");
  const configMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of configs) m.set(c.id, c.icon ? `${c.icon} ${c.name}` : c.name);
    return m;
  }, [configs]);

  const upcomingRuns = useMemo(() => {
    const runs: { trigger: Trigger; date: Date }[] = [];
    for (const t of cronTriggers) {
      if (!t.enabled) continue;
      for (const date of getNextRuns(t, 3)) {
        runs.push({ trigger: t, date });
      }
    }
    return runs.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 10);
  }, [cronTriggers]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="w-full">
        <span className="label block mb-1">{"// DASHBOARD"}</span>
        <h1 className="text-xl font-medium tracking-tight mb-6">
          Command Center
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="border border-border rounded-lg p-5 bg-background-secondary"
            >
              <span className="label-sm text-muted-darker block mb-2">
                {"// " + card.label}
              </span>
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-sm font-medium">{card.title}</h2>
                <span className="mono text-lg">{card.value}</span>
              </div>
              <p className="text-xs text-muted-dark">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Cron Triggers Section */}
        <div className="mt-8">
          <span className="label block mb-1">{"// SCHEDULED_TRIGGERS"}</span>
          <h2 className="text-lg font-medium tracking-tight mb-4">
            Cron Triggers
          </h2>

          {cronTriggers.length === 0 ? (
            <div className="border border-border rounded-lg p-6 bg-background-secondary text-center">
              <p className="text-sm text-muted-dark">No cron triggers configured</p>
              <p className="text-xs text-muted-darker mt-1">
                Create a trigger with type &quot;cron&quot; to schedule automated agent runs
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cronTriggers.map((trigger) => {
                const nextRuns = getNextRuns(trigger, 1);
                return (
                  <div
                    key={trigger.id}
                    className="border border-border rounded-lg p-4 bg-background-secondary"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium truncate">{trigger.name}</h3>
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          trigger.enabled ? "bg-green-500" : "bg-neutral-500"
                        }`}
                      />
                    </div>
                    {trigger.description && (
                      <p className="text-xs text-muted-dark mb-2 truncate">
                        {trigger.description}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-darker w-16">Schedule</span>
                        <span className="text-xs font-mono text-foreground">
                          {trigger.cronExpression
                            ? getCronDescription(trigger.cronExpression)
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-darker w-16">Agent</span>
                        <span className="text-xs text-foreground truncate">
                          {configMap.get(trigger.agentConfigId) ?? "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-darker w-16">Next</span>
                        <span className="text-xs font-mono text-foreground">
                          {trigger.enabled && nextRuns[0]
                            ? `in ${formatRelative(nextRuns[0])}`
                            : trigger.enabled
                            ? "—"
                            : "disabled"}
                        </span>
                      </div>
                      {trigger.lastTriggeredAt && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-muted-darker w-16">Last run</span>
                          <span className="text-xs font-mono text-muted-dark">
                            {new Date(trigger.lastTriggeredAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Runs Timeline */}
        {upcomingRuns.length > 0 && (
          <div className="mt-8">
            <span className="label block mb-1">{"// UPCOMING_RUNS"}</span>
            <h2 className="text-lg font-medium tracking-tight mb-4">
              Upcoming Runs
            </h2>
            <div className="border border-border rounded-lg bg-background-secondary overflow-hidden">
              {upcomingRuns.map((run, i) => (
                <div
                  key={`${run.trigger.id}-${i}`}
                  className="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-0"
                >
                  <span className="text-xs font-mono text-muted-dark w-20 flex-shrink-0">
                    {formatRelative(run.date)}
                  </span>
                  <span className="text-xs font-mono text-foreground w-40 flex-shrink-0">
                    {run.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-sm text-foreground truncate flex-1">
                    {run.trigger.name}
                  </span>
                  <span className="text-xs text-muted-dark truncate max-w-48">
                    {configMap.get(run.trigger.agentConfigId) ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory Stats */}
        <div className="mt-8 border border-border rounded-lg bg-background-secondary">
          <div className="px-5 pt-5">
            <span className="label-sm text-muted-darker block mb-2">{"// MEMORY_STATS"}</span>
            <h2 className="text-sm font-medium mb-2">Memory Overview</h2>
          </div>
          <StatsTab />
        </div>
      </div>
    </div>
  );
}
