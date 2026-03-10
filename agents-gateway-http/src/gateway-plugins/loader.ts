import type { PluginEntry } from "agents-runtime";

import type { GatewayPluginManifest, ResolvedGatewayPlugin } from "../types/gateway-plugins.js";

export async function loadGatewayPlugins(
  entries: PluginEntry[] = [],
): Promise<ResolvedGatewayPlugin[]> {
  const plugins: ResolvedGatewayPlugin[] = [];

  for (const entry of entries) {
    let mod: Record<string, unknown>;
    try {
      mod = await import(entry.package);
    } catch (err) {
      throw new Error(
        `Plugin "${entry.package}" could not be imported. Is it in the workspace? ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const manifest = mod.manifest;
    if (!manifest || typeof manifest !== "object") {
      throw new Error(
        `Package "${entry.package}" does not export a manifest. Expected: export const manifest: GatewayPluginManifest`,
      );
    }

    const m = manifest as GatewayPluginManifest;
    if (!m.id || typeof m.id !== "string") {
      throw new Error(
        `Plugin "${entry.package}" manifest is missing a valid "id" field`,
      );
    }
    if (m.type !== "gateway") {
      throw new Error(
        `Plugin "${entry.package}" has type "${m.type}". Only "gateway" plugins are supported. Use agents-runtime.extensions for agent behavior.`,
      );
    }
    if (typeof m.create !== "function") {
      throw new Error(
        `Plugin "${entry.package}" manifest is missing a "create" function`,
      );
    }

    const config = entry.config ?? {};
    const plugin = m.create(config);
    plugins.push({ config, plugin });

    console.log(`[plugins] loaded: ${m.id} from ${entry.package}`);
  }

  return plugins;
}
