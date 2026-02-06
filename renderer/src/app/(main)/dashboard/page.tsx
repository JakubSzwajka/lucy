"use client";

import { useMainContext } from "../layout";

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
  const { settings } = useMainContext();

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto">
        <span className="label block mb-1">{"// DASHBOARD"}</span>
        <h1 className="text-xl font-medium tracking-tight mb-6">
          Command Center
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
