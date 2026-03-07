export const MEMORY_PLUGIN_ID = "memory";

export { createMemoryPlugin } from "./plugin.js";

export type {
  MemoryContextRecord,
  MemoryPlugin,
  MemoryPluginConfig,
  MemoryPluginContext,
  MemoryPluginObservedRun,
  MemoryPluginOptions,
  MemoryPluginPrepareContextInput,
  MemoryPluginPrepareContextResult,
  MemoryPluginRunCompleteInput,
  MemoryPluginSystemPromptSectionShape,
} from "./types.js";
