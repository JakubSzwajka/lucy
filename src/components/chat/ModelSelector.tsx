"use client";

import { AVAILABLE_MODELS } from "@/lib/ai/models";
import type { ModelConfig, AvailableProviders } from "@/types";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  availableProviders,
}: ModelSelectorProps) {
  const isModelAvailable = (model: ModelConfig): boolean => {
    if (!availableProviders) return true;
    return availableProviders[model.provider];
  };

  return (
    <div className="flex items-center gap-2">
      <span className="label-dark">MODEL //</span>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="bg-transparent border border-border rounded px-3 py-1.5 text-xs mono uppercase tracking-wide text-foreground focus:outline-none focus:border-muted-darker cursor-pointer"
      >
        {AVAILABLE_MODELS.map((model: ModelConfig) => {
          const available = isModelAvailable(model);
          return (
            <option key={model.id} value={model.id} disabled={!available} className="bg-background">
              {model.name}{!available ? " (N/A)" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}
