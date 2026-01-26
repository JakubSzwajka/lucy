"use client";

interface ChatOptionsPanelProps {
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  supportsThinking: boolean;
}

export function ChatOptionsPanel({
  thinkingEnabled,
  onThinkingChange,
  supportsThinking,
}: ChatOptionsPanelProps) {
  if (!supportsThinking) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-2 py-1.5">
      <button
        type="button"
        onClick={() => onThinkingChange(!thinkingEnabled)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          thinkingEnabled
            ? "bg-accent/20 text-accent border border-accent/30"
            : "bg-background-secondary/50 text-muted-dark border border-border hover:border-muted-dark"
        }`}
      >
        <span className="text-sm">🧠</span>
        <span>Thinking</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            thinkingEnabled ? "bg-accent" : "bg-muted-dark"
          }`}
        />
      </button>
    </div>
  );
}
