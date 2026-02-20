"use client";

import type { SystemPrompt } from "@/types";

interface PromptsListProps {
  prompts: SystemPrompt[];
  selectedPromptId: string | null;
  onSelectPrompt: (id: string | null) => void;
  onNewPrompt: () => void;
}

export function PromptsList({
  prompts,
  selectedPromptId,
  onSelectPrompt,
  onNewPrompt,
}: PromptsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <span className="label-dark">System Prompts</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {prompts.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-sm text-muted-dark">No prompts yet</span>
            <p className="text-xs text-muted-darker mt-1">
              Create your first prompt
            </p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onSelectPrompt(prompt.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-background-secondary transition-colors ${
                selectedPromptId === prompt.id ? "bg-background-secondary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate flex-1">
                  {prompt.name}
                </span>
              </div>
              <p className="text-xs text-muted-dark mt-1 truncate">
                {prompt.content.slice(0, 60)}
                {prompt.content.length > 60 ? "..." : ""}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onNewPrompt}
          className="w-full text-xs px-2 py-1.5 border border-border rounded hover:bg-background-secondary"
        >
          + New
        </button>
      </div>
    </div>
  );
}
