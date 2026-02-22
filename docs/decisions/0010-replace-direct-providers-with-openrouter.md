---
status: implemented
date: 2026-02-19
decision-makers: kuba
---

# Replace direct AI providers with OpenRouter

## Context and Problem Statement

Lucy currently integrates with three AI providers directly (OpenAI, Anthropic, Google), each requiring its own API key, SDK package, and provider-specific logic (e.g., Anthropic thinking budgets, OpenAI reasoning effort). The model catalog is a static hardcoded array in `models.ts` — adding a model means editing code and redeploying.

This creates three problems:
1. **Multiple API keys and billing sources** — three accounts to fund and monitor.
2. **Static model list** — falls behind as providers release new models.
3. **Provider-specific code** — `buildProviderOptions()` has branching logic per provider that grows with each new provider.

OpenRouter (https://openrouter.ai) provides a unified, OpenAI-compatible API that proxies to 400+ models across all major providers. One API key, one billing source, dynamic model discovery via `/api/v1/models`.

## Decision

Replace all three direct provider integrations with a single OpenRouter provider. Fetch the model catalog dynamically from OpenRouter's models endpoint.

### What changes

- **Single provider**: Use `@ai-sdk/openai` with `baseURL: "https://openrouter.ai/api/v1"` and `OPENROUTER_API_KEY`. No new SDK packages needed.
- **Dynamic models**: Fetch available models from `GET https://openrouter.ai/api/v1/models`. Map OpenRouter's response schema to our `ModelConfig` type.
- **Reasoning support**: Derive `supportsReasoning` from OpenRouter's `supported_parameters` array (check for `"reasoning"` entry) instead of hardcoding per model.
- **Remove old providers**: Delete `@ai-sdk/anthropic`, `@ai-sdk/google` packages and all provider-specific branching.

### Non-goals

- No UI changes to the model picker beyond consuming the dynamic list.
- No caching or pagination strategy for the models endpoint (fetch on every request initially; optimize later if needed).
- No OpenRouter-specific features (prompt transforms, provider routing preferences, cost optimization) — just use it as a passthrough.

## Consequences

* Good, because one API key and one billing source simplifies ops and onboarding.
* Good, because models are always up-to-date without code changes.
* Good, because provider-specific branching in `buildProviderOptions()` is eliminated.
* Good, because new models (from any provider) become available automatically.
* Bad, because OpenRouter becomes a single point of failure (if it's down, no AI).
* Bad, because slight latency overhead from proxying through OpenRouter.
* Bad, because pricing includes OpenRouter's markup on top of provider costs.

## Implementation Plan

* **Affected paths**:
  - `backend/src/lib/server/ai/providers.ts` — rewrite: single OpenRouter client via `createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY })`
  - `backend/src/lib/server/ai/models.ts` — rewrite: replace static array with function that fetches from OpenRouter `/api/v1/models` and maps to `ModelConfig`
  - `backend/src/lib/server/ai/types/index.ts` — simplify: `ModelConfig.provider` becomes `"openrouter"` (single value), add OpenRouter response types
  - `backend/src/app/api/models/route.ts` — update: call new dynamic model fetcher
  - `backend/src/app/api/providers/route.ts` — simplify: just check `OPENROUTER_API_KEY` exists
  - `backend/src/lib/server/services/chat/chat.service.ts` — simplify: remove provider switching in `buildProviderOptions()`, remove multi-provider model resolution
  - `backend/src/lib/server/services/config/settings.service.ts` — review: `enabledModels` filter still works against dynamic list
  - `backend/package.json` — remove `@ai-sdk/anthropic`, `@ai-sdk/google`; keep `@ai-sdk/openai`
  - `.env.example` — replace `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` with `OPENROUTER_API_KEY`

* **Dependencies**:
  - Remove: `@ai-sdk/anthropic`, `@ai-sdk/google`
  - Keep: `@ai-sdk/openai` (used with custom baseURL for OpenRouter)
  - Keep: `ai` (Vercel AI SDK core)

* **Patterns to follow**:
  - Vercel AI SDK's `createOpenAI()` with custom `baseURL` — this is the documented OpenRouter integration path
  - Existing `getLanguageModel()` / `getModelConfig()` function signatures (callers shouldn't change)
  - Keep `ModelConfig` as the internal type — map OpenRouter's schema to it

* **Patterns to avoid**:
  - Do not install OpenRouter's own SDK — `@ai-sdk/openai` with custom base URL is sufficient
  - Do not hardcode any model IDs — everything comes from the dynamic fetch
  - Do not add provider-specific branching back (the whole point is eliminating it)

### Steps

1. Add OpenRouter response types to `backend/src/lib/server/ai/types/index.ts`
2. Rewrite `backend/src/lib/server/ai/providers.ts` — single OpenRouter client, simplified `getLanguageModel()` and `getAvailableProviders()`
3. Rewrite `backend/src/lib/server/ai/models.ts` — fetch from OpenRouter, map to `ModelConfig`
4. Simplify `backend/src/lib/server/services/chat/chat.service.ts` — remove `buildProviderOptions()` branching
5. Update `backend/src/app/api/models/route.ts` and `backend/src/app/api/providers/route.ts`
6. Update `.env.example`, remove old API key references
7. Remove `@ai-sdk/anthropic` and `@ai-sdk/google` from `package.json`
8. Run `npm install` and `npm run build` in `backend/`

### Verification

- [ ] `backend/` builds with no type errors (`npm run build`)
- [ ] `GET /api/models` returns a dynamic list fetched from OpenRouter
- [ ] `GET /api/providers` returns `{ openrouter: true }` when `OPENROUTER_API_KEY` is set
- [ ] Chat streaming works end-to-end with an OpenRouter model (send a message, receive SSE response)
- [ ] Tool calling works through OpenRouter
- [ ] No references to `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY` remain in source code
- [ ] `@ai-sdk/anthropic` and `@ai-sdk/google` are not in `package.json`
- [ ] Models with `"reasoning"` in `supported_parameters` have `supportsReasoning: true` in the mapped config

## Alternatives Considered

* **Add OpenRouter alongside existing providers**: Rejected — adds complexity without removing the multi-key, multi-billing problem. Defeats the simplification goal.
* **Use OpenRouter's native SDK**: Rejected — `@ai-sdk/openai` with custom base URL is simpler and already a dependency. No new package needed.
* **Keep static model list, just switch the provider**: Rejected — loses the dynamic model discovery benefit, which is half the value of OpenRouter.
