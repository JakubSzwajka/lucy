"use client";

import { useState, useEffect } from "react";
import type { SystemPrompt, SystemPromptCreate, SystemPromptUpdate } from "@/types";

interface PromptEditorProps {
  prompt: SystemPrompt | null;
  isNew: boolean;
  isDefault: boolean;
  onSave: (data: SystemPromptCreate | SystemPromptUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  onCancel: () => void;
}

const MAX_CONTENT_LENGTH = 10000;

export function PromptEditor({
  prompt,
  isNew,
  isDefault,
  onSave,
  onDelete,
  onSetDefault,
  onCancel,
}: PromptEditorProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setContent(prompt.content);
    } else {
      setName("");
      setContent("");
    }
    setShowDeleteConfirm(false);
  }, [prompt]);

  const hasChanges =
    isNew || (prompt && (name !== prompt.name || content !== prompt.content));

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), content: content.trim() });
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

  if (!prompt && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-muted-dark">
        <p className="text-sm">Select a prompt or create a new one</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden">
      {/* Name input */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Code Expert"
          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        />
      </div>

      {/* Content textarea */}
      <div className="flex-1 flex flex-col mb-4 min-h-0 overflow-hidden">
        <label className="label-dark block mb-2 flex-shrink-0">Content</label>
        <textarea
          value={content}
          onChange={(e) =>
            setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))
          }
          placeholder="Enter the system prompt content..."
          className="flex-1 w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker resize-none min-h-[150px]"
        />
        <div className="flex justify-between mt-1 flex-shrink-0">
          <p className="text-xs text-muted-dark">
            The system prompt will be included at the start of every new
            conversation
          </p>
          <span className="text-xs text-muted-dark">
            {content.length} / {MAX_CONTENT_LENGTH}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          {!isNew && (
            <>
              {showDeleteConfirm ? (
                <>
                  <span className="text-xs text-muted-dark mr-2">
                    Are you sure?
                  </span>
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
          {!isNew && !isDefault && (
            <button
              onClick={onSetDefault}
              className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary"
            >
              Set as Default
            </button>
          )}
          {!isNew && isDefault && (
            <span className="text-xs text-muted-dark flex items-center gap-1 px-3 py-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-yellow-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Default
            </span>
          )}
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
