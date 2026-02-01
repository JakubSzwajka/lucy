"use client";

import { useMemo, useState } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
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
import { estimateConversationTokens, getContextUsage } from "@/lib/ai/tokens";
import { AVAILABLE_MODELS, getModelConfig } from "@/lib/ai/models";
import type { ChatMessage, ModelConfig, AvailableProviders } from "@/types";
import { ChevronDown, Lightbulb } from "lucide-react";

type Provider = ModelConfig["provider"];

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  messages?: ChatMessage[];
  modelConfig?: ModelConfig;
  // Model selector props
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
  // Thinking toggle props
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  supportsThinking: boolean;
}

export function ChatInput({
  onSend,
  isLoading,
  messages = [],
  modelConfig,
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
  thinkingEnabled,
  onThinkingChange,
  supportsThinking,
}: ChatInputProps) {
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const contextUsage = useMemo(() => {
    if (!modelConfig) return null;
    const tokens = estimateConversationTokens(messages);
    return getContextUsage(tokens, modelConfig.maxContextTokens);
  }, [messages, modelConfig]);

  const handleSubmit = ({ text }: { text: string }) => {
    if (text.trim()) {
      onSend(text.trim());
    }
  };

  // Model selector logic
  const isModelAvailable = (model: ModelConfig): boolean => {
    if (!availableProviders) return true;
    return availableProviders[model.provider];
  };

  const isModelEnabled = (model: ModelConfig): boolean => {
    if (!enabledModels) return true;
    return enabledModels.includes(model.id);
  };

  const visibleModels = useMemo(
    () => AVAILABLE_MODELS.filter((model) => isModelEnabled(model)),
    [enabledModels]
  );

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

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setModelSelectorOpen(false);
  };

  return (
    <div className="p-6 border-t border-border bg-background">
      <PromptInput
        onSubmit={handleSubmit}
        className="border border-border rounded-lg focus-within:border-muted-darker transition-all bg-background-secondary/20"
      >
        <PromptInputTextarea
          placeholder="Type a message or command..."
          disabled={isLoading}
          className="min-h-[40px] max-h-32 py-3 px-3 text-sm border-none bg-transparent focus:outline-none focus:ring-0 placeholder:text-muted-dark"
        />
        <PromptInputFooter className="px-2 pb-2">
          <PromptInputTools>
            {/* Model Selector */}
            <ModelSelectorRoot open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
              <ModelSelectorTrigger asChild>
                <PromptInputButton className="gap-1.5 text-muted-foreground hover:text-foreground">
                  {selectedModelConfig && (
                    <ModelSelectorLogo provider={selectedModelConfig.provider} />
                  )}
                  <span className="text-xs">{selectedModelConfig?.name ?? selectedModel}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </PromptInputButton>
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
                              onSelect={() => handleModelSelect(model.id)}
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

            {/* Thinking Toggle */}
            {supportsThinking && (
              <PromptInputButton
                onClick={() => onThinkingChange(!thinkingEnabled)}
                className={`gap-1.5 ${thinkingEnabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Lightbulb className={`size-3.5 ${thinkingEnabled ? "text-amber-500" : ""}`} />
                <span className="text-xs">Thinking</span>
                <span
                  className={`size-1.5 rounded-full transition-all ${
                    thinkingEnabled ? "bg-emerald-400" : "bg-muted-dark"
                  }`}
                />
              </PromptInputButton>
            )}
          </PromptInputTools>
          <PromptInputSubmit
            disabled={isLoading}
            className="btn-ship"
            status={isLoading ? "streaming" : undefined}
          >
            Ship
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>

      <div className="mt-2 flex gap-4 justify-between">
        <div className="flex gap-4">
          <span className="label-sm text-muted-darkest">
            SHORTCUTS: ENTER TO SHIP • SHIFT+ENTER FOR NEW LINE
          </span>
          <span className="label-sm text-muted-darkest">MODE: CHAT_v1.0</span>
        </div>
        {contextUsage && (
          <span
            className={`label-sm ${
              contextUsage.isOverLimit
                ? "text-red-500"
                : contextUsage.isNearLimit
                  ? "text-yellow-500"
                  : "text-muted-darkest"
            }`}
          >
            CTX: {contextUsage.formatted} ({contextUsage.percentage}%)
          </span>
        )}
      </div>
    </div>
  );
}
