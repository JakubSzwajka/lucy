# AI Provider Abstraction Layer

This module provides a unified interface for working with multiple AI providers (Anthropic, OpenAI, Google) through the Vercel AI SDK.

## Purpose

The AI layer abstracts provider-specific implementations behind a common interface, enabling:

- **Model Selection**: A centralized registry of available models across providers
- **Provider Factories**: Consistent API for creating language model instances
- **Token Estimation**: Universal token counting for context tracking
- **Capability Detection**: Model-level feature flags (e.g., reasoning support)

## Files

| File | Description |
|------|-------------|
| `models.ts` | Model registry with configurations and capabilities |
| `providers.ts` | Provider factory functions using AI SDK |
| `tokens.ts` | Token estimation utilities for context tracking |

## Model Registry

### `models.ts`

Defines all available models in the `AVAILABLE_MODELS` array. Each model follows the `ModelConfig` interface:

```typescript
interface ModelConfig {
  id: string;                          // Unique identifier (e.g., "claude-opus-4-5")
  name: string;                        // Display name (e.g., "Claude Opus 4.5")
  provider: "openai" | "anthropic" | "google";
  modelId: string;                     // Provider's model ID (e.g., "claude-opus-4-5-20251101")
  supportsReasoning?: boolean;         // Extended thinking capability
  maxContextTokens: number;            // Maximum context window size
}
```

### Available Models

| ID | Provider | Context | Reasoning |
|----|----------|---------|-----------|
| `gpt-4o` | OpenAI | 128K | No |
| `gpt-4o-mini` | OpenAI | 128K | No |
| `o1` | OpenAI | 200K | Yes |
| `o1-mini` | OpenAI | 128K | Yes |
| `o3-mini` | OpenAI | 200K | Yes |
| `claude-opus-4-5` | Anthropic | 200K | Yes |
| `claude-opus-4` | Anthropic | 200K | Yes |
| `claude-sonnet-4` | Anthropic | 200K | Yes |
| `claude-3-5-haiku` | Anthropic | 200K | No |
| `gemini-2.0-flash` | Google | 1M | No |

### Exports

- `AVAILABLE_MODELS` - Array of all model configurations
- `DEFAULT_MODEL` - First model in the array (gpt-4o)
- `getModelConfig(modelId: string)` - Lookup function to find a model by ID

## Provider Factories

### `providers.ts`

Creates provider instances using the Vercel AI SDK. Each provider is initialized with its API key from environment variables.

```typescript
// Environment variables required:
// - OPENAI_API_KEY
// - ANTHROPIC_API_KEY
// - GOOGLE_API_KEY
```

### Exports

#### `getLanguageModel(config: ModelConfig)`

Returns an AI SDK language model instance for the given configuration. Automatically routes to the correct provider based on `config.provider`.

```typescript
import { getLanguageModel } from "@/lib/ai/providers";
import { getModelConfig } from "@/lib/ai/models";

const config = getModelConfig("claude-opus-4-5");
const model = getLanguageModel(config);

// Use with AI SDK's streamText, generateText, etc.
```

#### `getAvailableProviders()`

Returns an object indicating which providers have API keys configured:

```typescript
interface AvailableProviders {
  openai: boolean;
  anthropic: boolean;
  google: boolean;
}
```

## Token Counting

### `tokens.ts`

Provides universal token estimation that works across all providers. Uses a blended approach combining word-based and character-based estimates.

### Exports

#### `estimateTokens(text: string): number`

Estimates token count for a text string. Accuracy is ~80-90% for English text, less accurate for code-heavy content.

```typescript
estimateTokens("Hello, world!"); // ~5 tokens
```

#### `estimateConversationTokens(messages: Array<{ role: string; content: string }>): number`

Estimates tokens for a conversation history, including per-message overhead (~4 tokens per message for role/formatting).

```typescript
estimateConversationTokens([
  { role: "user", content: "Hello" },
  { role: "assistant", content: "Hi there!" }
]); // ~12 tokens
```

#### `getContextUsage(currentTokens: number, maxTokens: number)`

Returns context usage metrics:

```typescript
const usage = getContextUsage(50000, 200000);
// {
//   ratio: 0.25,
//   percentage: 25,
//   formatted: "50K / 200K",
//   isNearLimit: false,   // true when > 80%
//   isOverLimit: false    // true when > 100%
// }
```

#### `formatTokenCount(tokens: number): string`

Formats token counts for display:

```typescript
formatTokenCount(128000);   // "128K"
formatTokenCount(1000000);  // "1M"
formatTokenCount(500);      // "500"
```

## Adding New Models

To add a new model:

1. Add an entry to `AVAILABLE_MODELS` in `models.ts`:

```typescript
{
  id: "new-model-id",           // Your unique identifier
  name: "New Model Display",    // User-facing name
  provider: "openai",           // Must be: openai | anthropic | google
  modelId: "provider-model-id", // The provider's actual model ID
  supportsReasoning: false,     // Set true if model supports extended thinking
  maxContextTokens: 128_000,    // Context window size
}
```

2. Ensure the provider's API key environment variable is set.

## Adding New Providers

To add a new provider:

1. Install the AI SDK package for the provider:

```bash
npm install @ai-sdk/newprovider
```

2. Update `providers.ts`:

```typescript
import { createNewProvider } from "@ai-sdk/newprovider";

const newProvider = createNewProvider({
  apiKey: process.env.NEW_PROVIDER_API_KEY,
});

// Add case to getLanguageModel switch
case "newprovider":
  model = newProvider(config.modelId);
  break;
```

3. Update `getAvailableProviders()` to include the new provider.

4. Update the `ModelConfig` type in `renderer/src/types/index.ts`:

```typescript
provider: "openai" | "anthropic" | "google" | "newprovider";
```

5. Update `AvailableProviders` interface in the same file.

## Dependencies

This module uses the [Vercel AI SDK](https://sdk.vercel.ai/docs) ecosystem:

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | ^6.0.67 | Core AI SDK with streaming, tools, etc. |
| `@ai-sdk/openai` | ^3.0.23 | OpenAI provider (GPT-4o, o1, o3) |
| `@ai-sdk/anthropic` | ^3.0.23 | Anthropic provider (Claude models) |
| `@ai-sdk/google` | ^3.0.13 | Google provider (Gemini models) |
| `@ai-sdk/react` | ^3.0.51 | React hooks for AI SDK |
| `@ai-sdk/mcp` | ^1.0.13 | Model Context Protocol support |

## Usage Example

```typescript
import { getModelConfig, AVAILABLE_MODELS } from "@/lib/ai/models";
import { getLanguageModel, getAvailableProviders } from "@/lib/ai/providers";
import { estimateTokens, getContextUsage } from "@/lib/ai/tokens";
import { streamText } from "ai";

// Check available providers
const providers = getAvailableProviders();
if (!providers.anthropic) {
  throw new Error("Anthropic API key not configured");
}

// Get model configuration
const modelConfig = getModelConfig("claude-opus-4-5");
const model = getLanguageModel(modelConfig);

// Estimate context usage before sending
const messages = [{ role: "user", content: "Hello!" }];
const tokens = estimateConversationTokens(messages);
const usage = getContextUsage(tokens, modelConfig.maxContextTokens);

if (usage.isNearLimit) {
  console.warn("Approaching context limit");
}

// Stream response
const result = await streamText({
  model,
  messages,
});
```
