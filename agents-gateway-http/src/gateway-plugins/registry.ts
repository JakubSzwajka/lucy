import type {
  GatewayPluginRegistry,
  GatewayPluginsConfig,
  ResolvedGatewayPlugin,
} from "../types/gateway-plugins.js";

export function resolveGatewayPlugins(
  config: GatewayPluginsConfig = { enabled: [] },
  pluginRegistry: GatewayPluginRegistry = {},
): ResolvedGatewayPlugin[] {
  const enabledPluginIds = config.enabled ?? [];
  const pluginConfigById = config.configById ?? {};

  return enabledPluginIds.map((pluginId) => {
    const plugin = pluginRegistry[pluginId];
    if (!plugin) {
      throw new Error(`Gateway plugin "${pluginId}" is enabled but not installed`);
    }
    if (plugin.id !== pluginId) {
      throw new Error(
        `Gateway plugin registry key "${pluginId}" does not match installed plugin id "${plugin.id}"`,
      );
    }

    return {
      config: pluginConfigById[pluginId] ?? {},
      plugin,
    };
  });
}
