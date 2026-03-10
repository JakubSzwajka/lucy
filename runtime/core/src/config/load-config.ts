import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { LucyConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = "lucy.config.json";

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

  return parsed as LucyConfig;
}
