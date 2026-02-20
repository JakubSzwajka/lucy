# AI Module

OpenRouter-based model access. All models are fetched dynamically from OpenRouter's API.

## Public API

- `fetchAvailableModels()`, `getModelConfig(modelId)` from `models.ts` (both async)
- `getAvailableProviders()` from `providers.ts`
- `getLanguageModel(modelConfig)` from `providers.ts`
- `buildProviderOptions(modelConfig, thinkingEnabled)` from `providers.ts`

## Use It Like This

```ts
import { getModelConfig } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";

const cfg = await getModelConfig("anthropic/claude-sonnet-4-6");
if (!cfg) throw new Error("unknown model");
const model = getLanguageModel(cfg);
```

## Responsibility Boundary

This module resolves provider clients and model configs.
It does not orchestrate turns, tools, or memory context.

## Read Next

- `../services/chat/README.md`
