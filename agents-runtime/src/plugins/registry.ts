import type {
  ResolvedRuntimePlugin,
  RuntimeConfig,
  RuntimePluginRegistry,
} from "../types.js";

export function resolveRuntimePlugins(
  config: RuntimeConfig = {},
  pluginRegistry: RuntimePluginRegistry = {},
): ResolvedRuntimePlugin[] {
  const enabledPluginIds = config.plugins?.enabled ?? [];
  const pluginConfigById = config.plugins?.configById ?? {};

  return enabledPluginIds.map((pluginId) => {
    const plugin = pluginRegistry[pluginId];
    if (!plugin) {
      throw new Error(`Runtime plugin "${pluginId}" is enabled but not installed`);
    }
    if (plugin.id !== pluginId) {
      throw new Error(
        `Runtime plugin registry key "${pluginId}" does not match installed plugin id "${plugin.id}"`,
      );
    }

    return {
      config: pluginConfigById[pluginId] ?? {},
      plugin,
    };
  });
}
