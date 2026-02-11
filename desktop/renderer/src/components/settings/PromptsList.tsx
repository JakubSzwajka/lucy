"use client";

import type { SystemPrompt } from "@/types";

interface PromptsListProps {
  prompts: SystemPrompt[];
  selectedPromptId: string | null;
  defaultPromptId: string | null;
  onSelectPrompt: (id: string | null) => void;
  onNewPrompt: () => void;
}

export function PromptsList({
  prompts,
  selectedPromptId,
  defaultPromptId,
  onSelectPrompt,
  onNewPrompt,
}: PromptsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="label-dark">System Prompts</span>
        <button
          onClick={onNewPrompt}
          className="text-xs px-2 py-1 border border-border rounded hover:bg-background-secondary"
        >
          + New
        </button>
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
                {defaultPromptId === prompt.id && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-yellow-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-muted-dark mt-1 truncate">
                {prompt.content.slice(0, 60)}
                {prompt.content.length > 60 ? "..." : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
