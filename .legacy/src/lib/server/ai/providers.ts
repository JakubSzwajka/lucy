import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelConfig, AvailableProviders } from "@/types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function getAvailableProviders(): AvailableProviders {
  return {
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}

export function getLanguageModel(config: ModelConfig) {
  return openrouter.chat(config.modelId);
}

export function buildProviderOptions(modelConfig: ModelConfig, thinkingEnabled: boolean): unknown {
  if (!modelConfig.supportsReasoning || !thinkingEnabled) {
    return undefined;
  }

  return {
    openai: {
      reasoningEffort: "medium" as const,
    },
  };
}
