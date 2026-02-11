"use client";

import { useEffect, useState } from "react";
import type { QuickAction, QuickActionCreate, QuickActionUpdate } from "@/types";

interface QuickActionEditorProps {
  action: QuickAction | null;
  isNew: boolean;
  onSave: (data: QuickActionCreate | QuickActionUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

const MAX_NAME_LENGTH = 100;

export function QuickActionEditor({
  action,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: QuickActionEditorProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (action) {
      setName(action.name);
      setIcon(action.icon ?? "");
      setContent(action.content);
      setEnabled(action.enabled);
      setSortOrder(action.sortOrder);
    } else {
      setName("");
      setIcon("");
      setContent("");
      setEnabled(true);
      setSortOrder(0);
    }
    setShowDeleteConfirm(false);
  }, [action]);

  const hasChanges =
    isNew || (action && (
      name !== action.name
      || icon !== (action.icon ?? "")
      || content !== action.content
      || enabled !== action.enabled
      || sortOrder !== action.sortOrder
    ));

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();
    if (!trimmedName || !trimmedContent) return;

    setIsSaving(true);
    try {
      await onSave({
        name: trimmedName,
        icon: icon.trim() || undefined,
        content: trimmedContent,
        enabled,
        sortOrder,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!action && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-muted-dark">
        <p className="text-sm">Select a quick action or create a new one</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden">
      <div className="mb-4">
        <label className="label-dark block mb-2">Name</label>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Morning Brief"
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        />
        <div className="text-xs text-muted-dark mt-1 text-right">
          {name.length} / {MAX_NAME_LENGTH}
        </div>
      </div>

      <div className="mb-4">
        <label className="label-dark block mb-2">Icon (optional)</label>
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="e.g., ☀️"
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        />
      </div>

      <div className="flex-1 flex flex-col mb-4 min-h-0 overflow-hidden">
        <label className="label-dark block mb-2 flex-shrink-0">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g., Give me a morning brief: check my pending tasks and summarize my recent conversations"
          className="flex-1 w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker resize-none min-h-[150px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-border bg-background-secondary"
          />
          Enabled
        </label>

        <div>
          <label className="label-dark block mb-2">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          {!isNew && (
            <>
              {showDeleteConfirm ? (
                <>
                  <span className="text-xs text-muted-dark mr-2">Are you sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs px-3 py-1.5 text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          {isNew && (
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !content.trim() || !hasChanges}
            className="text-xs px-4 py-1.5 bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
