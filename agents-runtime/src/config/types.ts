import type { RuntimeConfig } from "../types/plugins.js";

export interface PluginEntry {
  config?: Record<string, unknown>;
  package: string;
}

export interface GatewayAuthConfig {
  apiKey?: string;
}

export interface GatewayHttpConfig {
  allowedModels?: string[];
  auth?: GatewayAuthConfig;
  [key: string]: unknown;
}

export interface LucyConfig {
  "agents-gateway-http"?: GatewayHttpConfig;
  "agents-runtime"?: RuntimeConfig;
  plugins?: PluginEntry[];
  [key: string]: unknown;
}
