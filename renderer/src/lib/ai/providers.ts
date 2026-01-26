import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelConfig, AvailableProviders } from "@/types";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export function getAvailableProviders(): AvailableProviders {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  };
}

export function getLanguageModel(config: ModelConfig) {
  switch (config.provider) {
    case "openai":
      return openai(config.modelId);
    case "anthropic":
      return anthropic(config.modelId);
    case "google":
      return google(config.modelId);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
