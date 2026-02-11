"use client";

import { useMemories } from "@/hooks/useMemories";
import { memoryTypes, memoryStatuses, confidenceLevels } from "@/types/memory";
import type { Memory, MemoryType, MemoryStatus, ConfidenceLevel } from "@/types/memory";

const TYPE_COLORS: Record<MemoryType, string> = {
  fact: "bg-blue-500",
  preference: "bg-purple-500",
  relationship: "bg-green-500",
  principle: "bg-amber-500",
  commitment: "bg-red-500",
  moment: "bg-pink-500",
  skill: "bg-cyan-500",
};

function countBy<K extends string>(items: Memory[], key: (m: Memory) => K, allKeys: readonly K[]): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const k of allKeys) counts[k] = 0;
  for (const item of items) counts[key(item)]++;
  return counts;
}

export function StatsTab() {
  const { memories, isLoading } = useMemories({ limit: 1000 });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-dark">Loading stats...</div>;
  }

  const byType = countBy(memories, (m) => m.type, memoryTypes);
  const byStatus = countBy(memories, (m) => m.status, memoryStatuses);
  const byConfidence = countBy(memories, (m) => m.confidenceLevel, confidenceLevels);

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm text-foreground">
        <span className="mono text-2xl">{memories.length}</span>{" "}
        <span className="text-muted-dark">total memories</span>
      </div>

      <section>
        <h4 className="text-xs mono text-muted-dark uppercase mb-3">By Type</h4>
        <div className="space-y-2">
          {memoryTypes.map((type) => (
            <div key={type} className="flex items-center gap-3">
              <span className="w-24 text-xs text-muted-dark">{type}</span>
              <div className="flex-1 h-4 bg-background rounded overflow-hidden">
                <div
                  className={`h-full ${TYPE_COLORS[type]} rounded transition-all`}
                  style={{ width: memories.length ? `${(byType[type] / memories.length) * 100}%` : "0%" }}
                />
              </div>
              <span className="w-8 text-xs mono text-foreground text-right">{byType[type]}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs mono text-muted-dark uppercase mb-3">By Status</h4>
        <div className="flex gap-4">
          {memoryStatuses.map((status) => (
            <div key={status} className="text-center">
              <div className="mono text-lg text-foreground">{byStatus[status]}</div>
              <div className="text-[10px] text-muted-dark">{status}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs mono text-muted-dark uppercase mb-3">By Confidence</h4>
        <div className="flex gap-4">
          {confidenceLevels.map((level) => (
            <div key={level} className="text-center">
              <div className="mono text-lg text-foreground">{byConfidence[level]}</div>
              <div className="text-[10px] text-muted-dark">{level}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
