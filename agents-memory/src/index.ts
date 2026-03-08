import type { PluginManifest } from "agents-runtime";
import { resolveDataDir } from "agents-runtime";

import { createMemoryPlugin } from "./plugin.js";

export const MEMORY_PLUGIN_ID = "memory";

interface MemoryManifestConfig {
  dataDir?: string;
  maxFacts?: number;
  modelId?: string;
}

export const manifest: PluginManifest<MemoryManifestConfig> = {
  id: MEMORY_PLUGIN_ID,
  type: "runtime",
  create: (config) =>
    createMemoryPlugin({
      dataDir: config.dataDir ?? resolveDataDir(),
      observer: config.modelId
        ? { modelId: config.modelId, maxFacts: config.maxFacts }
        : undefined,
    }),
};

export { createMemoryPlugin } from "./plugin.js";

export type {
  CursorState,
  MemoryContextRecord,
  MemoryObserverConfig,
  MemoryPlugin,
  MemoryPluginConfig,
  MemoryPluginContext,
  MemoryPluginObservedRun,
  MemoryPluginOptions,
  MemoryPluginPrepareContextInput,
  MemoryPluginPrepareContextResult,
  MemoryPluginRunCompleteInput,
  MemoryPluginSystemPromptSectionShape,
  Observation,
  ObservationGate,
  ObservationType,
} from "./types.js";

export {
  CURSOR_PATH,
  MEMORY_DIR,
  MEMORY_MD_PATH,
  OBSERVATIONS_PATH,
} from "./types.js";
