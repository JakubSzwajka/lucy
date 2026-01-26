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
