# Langfuse Integration Specification

## Overview

This document specifies how to integrate [Langfuse](https://langfuse.com) observability into the Lucy desktop application to monitor LLM calls, tool executions, and agent activities.

**Integration Method:** OpenTelemetry-based tracing via `@langfuse/otel`

**Status:** ✅ Implemented

---

## Architecture Summary

### Current Lucy AI Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lucy Desktop App                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                                │
│  └── useAgentChat hook (@ai-sdk/react)                          │
│       └── POST /api/chat                                         │
├─────────────────────────────────────────────────────────────────┤
│  API Route (/api/chat/route.ts)                                  │
│  └── streamText() from 'ai' package                             │
│       ├── @ai-sdk/openai    (GPT-4o, o1, o3-mini)              │
│       ├── @ai-sdk/anthropic (Claude Opus, Sonnet, Haiku)        │
│       └── @ai-sdk/google    (Gemini 2.0 Flash)                  │
├─────────────────────────────────────────────────────────────────┤
│  MCP Tool Integration                                            │
│  └── @ai-sdk/mcp → MCP client pool (per session)                │
├─────────────────────────────────────────────────────────────────┤
│  Database (SQLite + Drizzle)                                     │
│  └── sessions, agents, items (messages, tool_calls, reasoning)  │
└─────────────────────────────────────────────────────────────────┘
```

### With Langfuse Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lucy Desktop App                          │
├─────────────────────────────────────────────────────────────────┤
│  Instrumentation (instrumentation.ts)                            │
│  └── NodeTracerProvider + LangfuseSpanProcessor                 │
├─────────────────────────────────────────────────────────────────┤
│  API Route (/api/chat/route.ts)                                  │
│  └── streamText({ experimental_telemetry: { isEnabled: true }}) │
│       ├── Traces: model calls, tokens, latency                  │
│       ├── Traces: tool executions and results                   │
│       └── Traces: reasoning/thinking steps                      │
├─────────────────────────────────────────────────────────────────┤
│                              ↓                                   │
│                    OpenTelemetry Spans                           │
│                              ↓                                   │
│                    LangfuseSpanProcessor                         │
│                              ↓                                   │
│                    Langfuse Cloud Dashboard                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Installation

### 1. Install Dependencies (Already Installed)

```bash
npm install langfuse @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node @opentelemetry/sdk-trace-node
```

### 2. Environment Variables

Add to `.env`:

```env
# Langfuse Configuration
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # EU region
# LANGFUSE_BASE_URL=https://us.cloud.langfuse.com  # US region

# Optional: Enable debug logging
# LANGFUSE_DEBUG=true
```

> **Note:** Get your keys from the Langfuse dashboard at Settings → API Keys.

---

## Implementation

### Step 1: Create Instrumentation File (Already Created)

File: `renderer/src/instrumentation.ts`

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Only initialize if Langfuse is configured
const isLangfuseConfigured =
  process.env.LANGFUSE_SECRET_KEY &&
  process.env.LANGFUSE_PUBLIC_KEY;

// Export the span processor for manual flushing in API routes
export let langfuseSpanProcessor: LangfuseSpanProcessor | null = null;

export function register() {
  if (!isLangfuseConfigured) {
    console.log("[Langfuse] Skipping initialization - missing API keys");
    return;
  }

  langfuseSpanProcessor = new LangfuseSpanProcessor({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  });

  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });

  sdk.start();
  console.log("[Langfuse] Tracing initialized");
}

// Graceful shutdown helper
export async function shutdown() {
  if (langfuseSpanProcessor) {
    await langfuseSpanProcessor.forceFlush();
    await langfuseSpanProcessor.shutdown();
    console.log("[Langfuse] Tracing shutdown complete");
  }
}
```

### Step 2: Enable Next.js Instrumentation

Update `renderer/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

### Step 3: Update Chat API Route (Already Updated)

Changes to `renderer/src/app/api/chat/route.ts`:

**Import added:**
```typescript
import { langfuseSpanProcessor } from "@/instrumentation";
```

**Telemetry enabled in streamText:**
```typescript
const result = streamText({
  model: languageModel,
  messages: modelMessages,
  tools: hasTools ? mcpTools : undefined,
  // ... other options ...

  // Enable Langfuse telemetry for LLM observability
  experimental_telemetry: {
    isEnabled: true,
    metadata: {
      agentId,
      sessionId: agent.sessionId,
      modelId: effectiveModelId,
      provider: modelConfig.provider,
      thinkingEnabled,
      hasTools,
    },
  },

  onFinish: async ({ text, reasoning }) => {
    // ... existing persistence logic ...

    // Flush Langfuse traces to ensure they're sent
    if (langfuseSpanProcessor) {
      await langfuseSpanProcessor.forceFlush();
    }
  },
});
```

### Step 4: Add Session/User Context (Optional)

For better trace organization, wrap calls with Langfuse context:

```typescript
import { Langfuse } from "@langfuse/tracing";

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

// In your API route
const trace = langfuse.trace({
  name: "chat-completion",
  sessionId: agent.sessionId,      // Links all messages in a session
  userId: "desktop-user",          // Or actual user ID if available
  metadata: {
    agentId,
    model,
    toolCount: Object.keys(aiSdkTools || {}).length,
  },
});

const result = await streamText({
  // ... config ...
  experimental_telemetry: {
    isEnabled: true,
    metadata: {
      langfuseTraceId: trace.id,
    },
  },
});
```

---

## What Gets Traced

### Automatic Traces (via experimental_telemetry)

| Trace Type | Data Captured |
|------------|---------------|
| **LLM Calls** | Model name, provider, input tokens, output tokens, latency, cost |
| **Streaming** | Stream lifecycle, time-to-first-token, total duration |
| **Tool Calls** | Tool name, arguments, execution time, results |
| **Multi-Step** | Each step in agentic workflows (when using maxSteps) |

### Custom Metadata

| Field | Purpose |
|-------|---------|
| `agentId` | Track which agent made the call |
| `sessionId` | Group all calls in a conversation |
| `modelId` | Which model configuration was used |
| `thinkingEnabled` | Whether extended thinking was enabled |

---

## Langfuse Dashboard Views

Once integrated, you'll see in the Langfuse dashboard:

### Traces View
- Complete request lifecycle
- Parent-child span relationships
- Tool execution within LLM calls

### Generations View
- All LLM completions
- Token counts and costs
- Model performance comparison

### Sessions View (if sessionId set)
- All traces grouped by conversation
- Conversation flow visualization

### Metrics
- Latency percentiles (P50, P95, P99)
- Token usage over time
- Cost analysis by model
- Error rates

---

## Desktop App Considerations

Since Lucy is an Electron desktop app (not serverless), there are specific considerations:

### 1. Trace Flushing (Implemented)

Unlike serverless functions that terminate, the desktop app runs continuously. Traces are flushed after each chat completion:

```typescript
// In onFinish callback of streamText
if (langfuseSpanProcessor) {
  await langfuseSpanProcessor.forceFlush();
}
```

### 2. Graceful Shutdown

The instrumentation runs within the Next.js server process (not the Electron main process). When the app quits:
- **Development:** The Next.js dev server stops, triggering OpenTelemetry's default shutdown
- **Production:** The standalone server process is killed by Electron

The `instrumentation.ts` exports a `shutdown()` function that can be called if needed, but the per-request flushing ensures traces are sent immediately.

### 3. Offline Handling

Langfuse batches and retries automatically. The default settings work well for desktop apps:
- Spans are batched and sent in the background
- Failed requests are retried with exponential backoff
- Per-request flushing ensures no data loss on app quit

---

## File Changes Summary

| File | Change | Status |
|------|--------|--------|
| `package.json` | Add `langfuse`, `@langfuse/tracing`, `@langfuse/otel`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node` | ✅ Done |
| `.env` | Add `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` placeholders | ✅ Done |
| `.env.example` | **NEW** - Document all environment variables | ✅ Done |
| `renderer/src/instrumentation.ts` | **NEW** - Initialize OpenTelemetry with Langfuse processor | ✅ Done |
| `renderer/next.config.js` | Enable `instrumentationHook` experimental feature | ✅ Done |
| `renderer/src/app/api/chat/route.ts` | Add `experimental_telemetry` to `streamText()` + flush on finish | ✅ Done |

---

## Testing the Integration

1. **Start the app in dev mode:**
   ```bash
   npm run dev
   ```

2. **Send a test message** through the chat interface

3. **Check Langfuse dashboard:**
   - Go to https://cloud.langfuse.com
   - Navigate to Traces
   - You should see your trace with:
     - Model call details
     - Token counts
     - Latency metrics
     - Tool calls (if any)

4. **Verify metadata:**
   - Click on a trace
   - Check that `agentId`, `sessionId`, `modelId` are present

---

## Cost Tracking

Langfuse automatically calculates costs based on:
- Model name (mapped to known pricing)
- Token counts (input/output)

For custom models or updated pricing, configure in Langfuse dashboard under Settings → Model Costs.

---

## Security Notes

- API keys should never be committed to git
- The `.env` file is already in `.gitignore`
- Langfuse stores traces; review their data retention policies
- Consider self-hosting Langfuse for sensitive data: https://langfuse.com/docs/deployment/self-host

---

## References

- [Langfuse Documentation](https://langfuse.com/docs)
- [Vercel AI SDK Telemetry](https://sdk.vercel.ai/docs/ai-sdk-core/telemetry)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/)
