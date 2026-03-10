import type { RuntimeConfig } from "../types/plugins.js";

export interface LucyConfig {
  runtime: RuntimeConfig;
  gateway?: {
    apiKey?: string;
  };
  whatsapp?: {
    phoneNumberId: string;
    verifyToken: string;
    allowedNumbers: string[];
  };
}
