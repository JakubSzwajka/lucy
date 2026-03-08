import { MEMORY_PLUGIN_ID, createMemoryPlugin } from "agents-memory";
import type { LucyConfig, RuntimePluginRegistry } from "agents-runtime";

import { DATA_DIR } from "./config.js";

export function buildPluginRegistry(lucyConfig?: LucyConfig): RuntimePluginRegistry {
  const memoryConfig = lucyConfig?.["agents-memory"];
  const modelId = typeof memoryConfig?.modelId === "string" ? memoryConfig.modelId : undefined;

  return {
    [MEMORY_PLUGIN_ID]: createMemoryPlugin({
      dataDir: DATA_DIR,
      observer: modelId ? { modelId, maxFacts: memoryConfig?.maxFacts as number | undefined } : undefined,
    }) as RuntimePluginRegistry[string],
  };
}
