export const MEMORY_PLUGIN_ID = "memory";

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
