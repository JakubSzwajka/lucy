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
  let model = undefined;
  switch (config.provider) {
    case "openai":
      model = openai(config.modelId);
      break;
    case "anthropic":
      model = anthropic(config.modelId);
      break;
    case "google":
      model = google(config.modelId);
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
  if (!model) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }
  return model;
}

  export function buildProviderOptions(modelConfig: ModelConfig, thinkingEnabled: boolean): unknown {
    if (!modelConfig.supportsReasoning || !thinkingEnabled) {
      return undefined;
    }

    if (modelConfig.provider === "openai") {
      return {
        openai: {
          reasoningEffort: "medium" as const,
        },
      };
    }

    if (modelConfig.provider === "anthropic") {
      return {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000,
          },
        },
      };
    }

    return undefined;
  }
