import type { RuntimeConfig } from "../types/plugins.js";

export interface LucyConfig {
  "agents-gateway-http"?: Record<string, unknown>;
  "agents-memory"?: Record<string, unknown>;
  "agents-runtime"?: RuntimeConfig;
  [key: string]: unknown;
}
