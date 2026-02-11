"use client";

import { useState } from "react";
import { useMemories } from "@/hooks/useMemories";
import { MemoryRow } from "./MemoryRow";
import { CreateMemoryDialog } from "./CreateMemoryDialog";
import { memoryTypes, memoryStatuses } from "@/types/memory";
import type { MemoryType, MemoryStatus, MemoryFilters } from "@/types/memory";

export function MemoriesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState<MemoryType | "">("");
  const [statusFilter, setStatusFilter] = useState<MemoryStatus | "">("");
  const [minConfidence, setMinConfidence] = useState<string>("");
  const [search, setSearch] = useState("");

  const filters: MemoryFilters = {};
  if (typeFilter) filters.type = typeFilter;
  if (statusFilter) filters.status = statusFilter;
  if (minConfidence) filters.minConfidence = parseFloat(minConfidence);
  if (search) filters.search = search;

  const { memories, isLoading, createMemory, updateMemory, deleteMemory, isCreating, isUpdating } = useMemories(filters);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as MemoryType | "")}
          className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
        >
          <option value="">All types</option>
          {memoryTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MemoryStatus | "")}
          className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
        >
          <option value="">All statuses</option>
          {memoryStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={minConfidence}
          onChange={(e) => setMinConfidence(e.target.value)}
          placeholder="Min conf."
          className="w-24 bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-[120px] bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
        />
      </div>

      {/* Memory list */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-dark">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="p-8 text-center">
          <span className="label-dark">{"// NO_MEMORIES"}</span>
          <p className="text-sm text-muted-dark mt-2">No memories found. Create one or run an extraction.</p>
        </div>
      ) : (
        <div>
          {memories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              onUpdate={updateMemory}
              onDelete={deleteMemory}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMemoryDialog
          onSubmit={createMemory}
          onClose={() => setShowCreate(false)}
          isCreating={isCreating}
        />
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 btn-ship w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        title="Add memory"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
