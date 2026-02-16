"use client";

import { useState } from "react";
import type { Memory, MemoryType, ConfidenceLevel, MemoryStatus, UpdateMemoryInput } from "@/types/memory";
import { memoryTypes, confidenceLevels, memoryStatuses } from "@/types/memory";

const TYPE_COLORS: Record<MemoryType, string> = {
  fact: "bg-blue-500/20 text-blue-400",
  preference: "bg-purple-500/20 text-purple-400",
  relationship: "bg-green-500/20 text-green-400",
  principle: "bg-amber-500/20 text-amber-400",
  commitment: "bg-red-500/20 text-red-400",
  moment: "bg-pink-500/20 text-pink-400",
  skill: "bg-cyan-500/20 text-cyan-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MemoryRowProps {
  memory: Memory;
  onUpdate: (id: string, updates: UpdateMemoryInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isUpdating: boolean;
}

export function MemoryRow({ memory, onUpdate, onDelete, isUpdating }: MemoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editType, setEditType] = useState<MemoryType>(memory.type);
  const [editConfidence, setEditConfidence] = useState(memory.confidenceScore);
  const [editConfidenceLevel, setEditConfidenceLevel] = useState<ConfidenceLevel>(memory.confidenceLevel);
  const [editStatus, setEditStatus] = useState<MemoryStatus>(memory.status);

  const handleSave = async () => {
    await onUpdate(memory.id, {
      content: editContent,
      type: editType,
      confidenceScore: editConfidence,
      confidenceLevel: editConfidenceLevel,
      status: editStatus,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this memory?")) {
      await onDelete(memory.id);
    }
  };

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background/50 transition-colors"
      >
        <span className={`text-[10px] mono px-1.5 py-0.5 rounded ${TYPE_COLORS[memory.type]}`}>
          {memory.type}
        </span>
        <span className="flex-1 text-sm text-foreground truncate">{memory.content}</span>
        <span className="text-xs mono text-muted-dark">{memory.confidenceScore.toFixed(2)}</span>
        <span className="text-xs font-mono text-muted-darker whitespace-nowrap">{timeAgo(memory.createdAt)}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 text-muted-dark transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground resize-none"
                rows={3}
              />
              <div className="flex gap-3">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as MemoryType)}
                  className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                >
                  {memoryTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={editConfidenceLevel}
                  onChange={(e) => setEditConfidenceLevel(e.target.value as ConfidenceLevel)}
                  className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                >
                  {confidenceLevels.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as MemoryStatus)}
                  className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                >
                  {memoryStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={editConfidence}
                  onChange={(e) => setEditConfidence(parseFloat(e.target.value))}
                  className="w-20 bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={isUpdating} className="btn-ship text-xs px-3 py-1">
                  {isUpdating ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted-dark hover:text-foreground px-3 py-1">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-foreground">{memory.content}</div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-dark">
                <span>Confidence: {memory.confidenceLevel} ({memory.confidenceScore.toFixed(2)})</span>
                <span>Status: {memory.status}</span>
                {memory.tags?.length > 0 && (
                  <span>Tags: {memory.tags.join(", ")}</span>
                )}
                {memory.scope && <span>Scope: {memory.scope}</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-muted-dark hover:text-foreground transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
