import { homedir } from "node:os";
import { join } from "node:path";

export function resolveDataDir(dataDir?: string): string {
  if (dataDir !== undefined) return dataDir;
  if (process.env.AGENTS_DATA_DIR) return process.env.AGENTS_DATA_DIR;
  return join(homedir(), ".agents-data");
}
