import { MEMORY_PLUGIN_ID, createMemoryPlugin } from "agents-memory";
import type { RuntimePluginRegistry } from "agents-runtime";

export function buildPluginRegistry(): RuntimePluginRegistry {
  return {
    [MEMORY_PLUGIN_ID]: createMemoryPlugin(),
  };
}
