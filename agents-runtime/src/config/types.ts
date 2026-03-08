import type { RuntimeConfig } from "../types/plugins.js";

export interface PluginEntry {
  config?: Record<string, unknown>;
  package: string;
}

export interface LucyConfig {
  "agents-gateway-http"?: {
    allowedModels?: string[];
    [key: string]: unknown;
  };
  "agents-runtime"?: RuntimeConfig;
  plugins?: PluginEntry[];
  [key: string]: unknown;
}
