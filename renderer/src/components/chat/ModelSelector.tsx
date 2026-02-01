"use client";

import { useState, useMemo } from "react";
import { AVAILABLE_MODELS, getModelConfig } from "@/lib/ai/models";
import type { ModelConfig, AvailableProviders } from "@/types";
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { ChevronDown } from "lucide-react";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
}

type Provider = ModelConfig["provider"];

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function ModelSelector({
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const isModelAvailable = (model: ModelConfig): boolean => {
    if (!availableProviders) return true;
    return availableProviders[model.provider];
  };

  const isModelEnabled = (model: ModelConfig): boolean => {
    if (!enabledModels) return true;
    return enabledModels.includes(model.id);
  };

  // Filter models to only show enabled ones
  const visibleModels = useMemo(
    () => AVAILABLE_MODELS.filter((model) => isModelEnabled(model)),
    [enabledModels]
  );

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<Provider, ModelConfig[]> = {
      openai: [],
      anthropic: [],
      google: [],
    };
    for (const model of visibleModels) {
      grouped[model.provider].push(model);
    }
    return grouped;
  }, [visibleModels]);

  const selectedModelConfig = getModelConfig(selectedModel);

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="label-dark">MODEL //</span>
      <ModelSelectorRoot open={open} onOpenChange={setOpen}>
        <ModelSelectorTrigger asChild>
          <button className="flex items-center gap-2 bg-transparent border border-border rounded px-3 py-1.5 text-xs mono uppercase tracking-wide text-foreground hover:border-muted-darker focus:outline-none focus:border-muted-darker cursor-pointer">
            {selectedModelConfig && (
              <ModelSelectorLogo provider={selectedModelConfig.provider} />
            )}
            <span>{selectedModelConfig?.name ?? selectedModel}</span>
            <ChevronDown className="size-3 opacity-50" />
          </button>
        </ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorInput placeholder="Search models..." />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            {(Object.entries(modelsByProvider) as [Provider, ModelConfig[]][])
              .filter(([, models]) => models.length > 0)
              .map(([provider, models]) => (
                <ModelSelectorGroup key={provider} heading={PROVIDER_LABELS[provider]}>
                  {models.map((model) => {
                    const available = isModelAvailable(model);
                    return (
                      <ModelSelectorItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => handleSelect(model.id)}
                        disabled={!available}
                        className="flex items-center gap-2"
                      >
                        <ModelSelectorLogo provider={model.provider} />
                        <ModelSelectorName>
                          {model.name}
                          {!available && " (N/A)"}
                        </ModelSelectorName>
                      </ModelSelectorItem>
                    );
                  })}
                </ModelSelectorGroup>
              ))}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelectorRoot>
    </div>
  );
}
