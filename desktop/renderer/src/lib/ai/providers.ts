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
