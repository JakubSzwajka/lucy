"use client";

import { useState } from "react";
import { memoryTypes, confidenceLevels } from "@/types/memory";
import type { MemoryType, ConfidenceLevel, CreateMemoryInput } from "@/types/memory";

interface CreateMemoryDialogProps {
  onSubmit: (input: CreateMemoryInput) => Promise<unknown>;
  onClose: () => void;
  isCreating: boolean;
}

export function CreateMemoryDialog({ onSubmit, onClose, isCreating }: CreateMemoryDialogProps) {
  const [type, setType] = useState<MemoryType>("fact");
  const [content, setContent] = useState("");
  const [confidenceScore, setConfidenceScore] = useState(0.9);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>("explicit");
  const [tags, setTags] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      type,
      content,
      confidenceScore,
      confidenceLevel,
      tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background-secondary border border-border rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="label mb-4">Add Memory</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-dark block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              {memoryTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-dark block mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground resize-none"
              rows={3}
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-dark block mb-1">Confidence Level</label>
              <select
                value={confidenceLevel}
                onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {confidenceLevels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-dark block mb-1">Score</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={confidenceScore}
                onChange={(e) => setConfidenceScore(parseFloat(e.target.value))}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-dark block mb-1">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
              placeholder="work, coding, personal"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-muted-dark hover:text-foreground px-4 py-2">
              Cancel
            </button>
            <button type="submit" disabled={!content || isCreating} className="btn-ship text-sm px-4 py-2">
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
