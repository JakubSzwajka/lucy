// Instrumentation file for Next.js
// Currently empty - can be used for future observability integrations

import { langfuseSdk } from "@/lib/tracing/langfuse";

export function register() {
  console.log("[Instrumentation] Registering instrumentation");
  try {
    langfuseSdk.start();
    console.log("[Instrumentation] Langfuse SDK started");
  } catch (error) {
    console.error("[Instrumentation] Error starting langfuse SDK:", error);
  }
}
