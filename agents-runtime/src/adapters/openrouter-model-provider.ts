import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { ModelProvider } from "../ports.js";
import type { ModelConfig } from "../types.js";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  supported_parameters?: string[];
  architecture?: { modality?: string };
}

export class OpenRouterModelProvider implements ModelProvider {
  private openrouter;
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is required");
    this.apiKey = key;
    this.openrouter = createOpenRouter({ apiKey: key });
  }

  async getModelConfig(modelId: string): Promise<ModelConfig | undefined> {
    const models = await this.fetchModels();
    return models.find((m) => m.id === modelId);
  }

  getLanguageModel(config: ModelConfig): LanguageModel {
    return this.openrouter.chat(config.modelId);
  }

  buildProviderOptions(
    config: ModelConfig,
    thinkingEnabled: boolean,
  ): unknown {
    if (!config.supportsReasoning || !thinkingEnabled) return undefined;
    return { openai: { reasoningEffort: "medium" as const } };
  }

  private async fetchModels(): Promise<ModelConfig[]> {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) return [];
    const data: { data: OpenRouterModel[] } = await response.json();
    return data.data.map(this.mapModel);
  }

  private mapModel(model: OpenRouterModel): ModelConfig {
    const inputModality = model.architecture?.modality?.split("->")[0] ?? "";
    return {
      id: model.id,
      name: model.name,
      provider: "openrouter",
      modelId: model.id,
      supportsReasoning:
        model.supported_parameters?.includes("reasoning") ?? false,
      supportsImages: inputModality.includes("image"),
      maxContextTokens: model.context_length,
    };
  }
}
