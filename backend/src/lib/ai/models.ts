import type {
  ModelConfig,
  OpenRouterModel,
  OpenRouterModelsResponse,
} from "@/types";

export async function fetchAvailableModels(): Promise<ModelConfig[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    console.error("Failed to fetch OpenRouter models:", response.status);
    return [];
  }

  const data: OpenRouterModelsResponse = await response.json();
  return data.data.map(mapOpenRouterModel);
}

function mapOpenRouterModel(model: OpenRouterModel): ModelConfig {
  return {
    id: model.id,
    name: model.name,
    provider: "openrouter",
    modelId: model.id,
    supportsReasoning:
      model.supported_parameters?.includes("reasoning") ?? false,
    maxContextTokens: model.context_length,
  };
}

export async function getModelConfig(
  modelId: string
): Promise<ModelConfig | undefined> {
  const models = await fetchAvailableModels();
  return models.find((m) => m.id === modelId);
}
