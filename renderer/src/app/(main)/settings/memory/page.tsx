"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MemoriesTab } from "@/components/memory/MemoriesTab";
import { QuestionsTab } from "@/components/memory/QuestionsTab";
import { IdentityTab } from "@/components/memory/IdentityTab";
type Tab = "memories" | "questions" | "identity";

const TABS: { key: Tab; label: string }[] = [
  { key: "memories", label: "Memories" },
  { key: "questions", label: "Questions" },
  { key: "identity", label: "Identity" },
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

      <div className="flex-1 overflow-y-auto">
        {activeTab === "memories" && <MemoriesTab />}
        {activeTab === "questions" && <QuestionsTab />}
        {activeTab === "identity" && <IdentityTab />}
      </div>
    </div>
  );
}
