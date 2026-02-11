import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

/**
 * Wraps LangfuseSpanProcessor to only forward AI SDK spans (ai.*).
 * This filters out Next.js RSC/HTTP spans that pollute the Langfuse dashboard.
 */
class AiOnlySpanProcessor extends LangfuseSpanProcessor {
  onEnd(span: Parameters<LangfuseSpanProcessor["onEnd"]>[0]): void {
    const isAiSpan = span.name.startsWith("ai.");
    const isLangfuseObservation = span.attributes["langfuse.observation.type"] !== undefined;
    if (isAiSpan || isLangfuseObservation) {
      super.onEnd(span);
    }
  }
}

export function register() {
  const sdk = new NodeSDK({
    spanProcessors: [new AiOnlySpanProcessor()],
  });
  sdk.start();
}
