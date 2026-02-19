import { createOpenAI } from "@ai-sdk/openai";
import type { ModelConfig, AvailableProviders } from "@/types";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function getAvailableProviders(): AvailableProviders {
  return {
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}

export function getLanguageModel(config: ModelConfig) {
  return openrouter(config.modelId);
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
