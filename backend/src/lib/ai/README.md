# AI Module

Provider-agnostic model access.

## Public API

- `AVAILABLE_MODELS`, `DEFAULT_MODEL`, `getModelConfig(modelId)` from `models.ts`
- `getAvailableProviders()` from `providers.ts`
- `getLanguageModel(modelConfig)` from `providers.ts`

## Use It Like This

```ts
import { getModelConfig } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";

const cfg = getModelConfig("gpt-4o-mini");
if (!cfg) throw new Error("unknown model");
const model = getLanguageModel(cfg);
```

## Responsibility Boundary

This module resolves provider clients and model configs.
It does not orchestrate turns, tools, or memory context.

## Read Next

- `../services/chat/README.md`
