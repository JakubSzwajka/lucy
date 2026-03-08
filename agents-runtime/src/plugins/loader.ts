import type { PluginEntry } from "../config/types.js";
import type {
  PluginManifest,
  ResolvedGatewayPlugin,
  ResolvedRuntimePlugin,
} from "../types.js";

export interface LoadedPlugins {
  gateway: ResolvedGatewayPlugin[];
  runtime: ResolvedRuntimePlugin[];
}

export async function loadPlugins(
  entries: PluginEntry[] = [],
): Promise<LoadedPlugins> {
  const runtime: ResolvedRuntimePlugin[] = [];
  const gateway: ResolvedGatewayPlugin[] = [];

  for (const entry of entries) {
    // 1. Dynamic import
    let mod: Record<string, unknown>;
    try {
      mod = await import(entry.package);
    } catch (err) {
      throw new Error(
        `Plugin "${entry.package}" could not be imported. Is it in the workspace? ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. Validate manifest export
    const manifest = mod.manifest;
    if (!manifest || typeof manifest !== "object") {
      throw new Error(
        `Package "${entry.package}" does not export a manifest. Expected: export const manifest: PluginManifest`,
      );
    }

    // 3. Validate manifest shape
    const m = manifest as PluginManifest;
    if (!m.id || typeof m.id !== "string") {
      throw new Error(
        `Plugin "${entry.package}" manifest is missing a valid "id" field`,
      );
    }
    if (!["runtime", "gateway", "both"].includes(m.type)) {
      throw new Error(
        `Plugin "${entry.package}" manifest has invalid type "${(m as unknown as Record<string, unknown>).type}". Expected: "runtime" | "gateway" | "both"`,
      );
    }
    if (typeof m.create !== "function") {
      throw new Error(
        `Plugin "${entry.package}" manifest is missing a "create" function`,
      );
    }

    const config = entry.config ?? {};

    // 4. Create plugin instance and register
    if (m.type === "runtime") {
      const plugin = m.create(config);
      runtime.push({ config, plugin });
    } else if (m.type === "gateway") {
      const plugin = m.create(config);
      gateway.push({ config, plugin });
    } else if (m.type === "both") {
      const result = m.create(config);
      runtime.push({ config, plugin: result.runtime });
      gateway.push({ config, plugin: result.gateway });
    }

    console.log(`[plugins] loaded: ${m.id} (${m.type}) from ${entry.package}`);
  }

  return { gateway, runtime };
}
