import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { CursorState } from "./types.js";
import { CURSOR_PATH } from "./types.js";

/**
 * Read cursor state from disk. Returns empty default if file is missing.
 */
export async function readCursor(dataDir: string): Promise<CursorState> {
  try {
    const raw = await readFile(join(dataDir, CURSOR_PATH), "utf-8");
    const parsed = JSON.parse(raw) as CursorState;
    return parsed;
  } catch {
    return { agents: {} };
  }
}

/**
 * Write cursor state atomically to disk.
 */
export async function writeCursor(
  dataDir: string,
  state: CursorState,
): Promise<void> {
  const filePath = join(dataDir, CURSOR_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
