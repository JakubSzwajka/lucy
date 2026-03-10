import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { LucyConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = "lucy.config.json";

const KNOWN_KEYS = ["agents-gateway-http", "agents-runtime"];

export async function loadConfig(path?: string): Promise<LucyConfig> {
  const configPath =
    path ?? process.env.LUCY_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;

  if (!existsSync(configPath)) {
    return {};
  }

  const raw = await readFile(configPath, "utf-8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must be a JSON object: ${configPath}`);
  }

  const config = parsed as Record<string, unknown>;

  for (const key of KNOWN_KEYS) {
    const value = config[key];
    if (
      value !== undefined &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      throw new Error(`Config key "${key}" must be an object in: ${configPath}`);
    }
  }

  if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
    throw new Error(`Config key "plugins" must be an array in: ${configPath}`);
  }

  // Detect old config shape and warn
  const runtime = config["agents-runtime"] as Record<string, unknown> | undefined;
  if (runtime?.compaction && typeof runtime.compaction === "object") {
    const compaction = runtime.compaction as Record<string, unknown>;
    if ("windowSize" in compaction) {
      console.warn(
        "[config] deprecated: agents-runtime.compaction.windowSize is no longer supported. " +
        "Use reserveTokens/keepRecentTokens instead. See agents-runtime/MIGRATION.md"
      );
    }
  }

  return config as LucyConfig;
}
