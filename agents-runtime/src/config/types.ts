import type { RuntimeConfig } from "../types/plugins.js";

export interface LucyConfig {
  "agents-gateway-http"?: {
    plugins?: {
      enabled: string[];
      configById?: Record<string, Record<string, unknown> | undefined>;
    };
    [key: string]: unknown;
  };
  "agents-memory"?: Record<string, unknown>;
  "agents-runtime"?: RuntimeConfig;
  [key: string]: unknown;
}
