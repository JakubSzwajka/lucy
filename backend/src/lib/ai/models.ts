import type { ModelConfig } from "@/types";

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.2-2025-12-11",
    name: "GPT-5.2",
    provider: "openai",
    modelId: "gpt-5.2-2025-12-11",
    maxContextTokens: 128_000,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    maxContextTokens: 128_000,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    maxContextTokens: 128_000,
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    modelId: "o1",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "o1-mini",
    name: "o1 Mini",
    provider: "openai",
    modelId: "o1-mini",
    supportsReasoning: true,
    maxContextTokens: 128_000,
  },
  {
    id: "o3-mini",
    name: "o3 Mini",
    provider: "openai",
    modelId: "o3-mini",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    modelId: "claude-opus-4-5-20251101",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    modelId: "claude-opus-4-6",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "claude-opus-4",
    name: "Claude Opus 4",
    provider: "anthropic",
    modelId: "claude-opus-4-20250514",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    supportsReasoning: true,
    maxContextTokens: 200_000,
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    maxContextTokens: 200_000,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    modelId: "gemini-2.0-flash",
    maxContextTokens: 1_000_000,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}
