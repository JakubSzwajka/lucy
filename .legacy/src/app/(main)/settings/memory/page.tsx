"use client";

import { useState, lazy, Suspense } from "react";
<<<<<<< Updated upstream:.legacy/src/app/(main)/settings/memory/page.tsx
import { cn } from "@/lib/client/utils";
=======
import { cn } from "@/lib/utils";
>>>>>>> Stashed changes:renderer/src/app/(main)/settings/memory/page.tsx
import { MemoriesTab } from "@/components/memory/MemoriesTab";
import { QuestionsTab } from "@/components/memory/QuestionsTab";
import { IdentityTab } from "@/components/memory/IdentityTab";

const MemoryGraph = lazy(() => import("@/components/memory/MemoryGraph").then(m => ({ default: m.MemoryGraph })));

type Tab = "memories" | "questions" | "identity" | "graph";

const TABS: { key: Tab; label: string }[] = [
  { key: "memories", label: "Memories" },
  { key: "questions", label: "Questions" },
  { key: "identity", label: "Identity" },
  { key: "graph", label: "Graph" },
];

export default function MemoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b border-border px-6 pt-6 pb-0">
        <h1 className="label text-lg mb-4">Memory Management</h1>
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-dark hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === "memories" && <MemoriesTab />}
        {activeTab === "questions" && <QuestionsTab />}
        {activeTab === "identity" && <IdentityTab />}
        {activeTab === "graph" && (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-muted-dark">Loading graph...</div>}>
            <MemoryGraph />
          </Suspense>
        )}
      </div>
    </div>
  );
}
