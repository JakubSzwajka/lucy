import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Observation } from "./types.js";
import { OBSERVATIONS_PATH } from "./types.js";

/**
 * Append observations to the JSONL file.
 * Assigns UUID ids and timestamps at write time.
 */
export async function appendObservations(
  dataDir: string,
  observations: Omit<Observation, "id" | "ts">[],
): Promise<Observation[]> {
  const now = Date.now();
  const full: Observation[] = observations.map((o) => ({
    ...o,
    id: randomUUID(),
    ts: now,
  }));

  const filePath = join(dataDir, OBSERVATIONS_PATH);
  await mkdir(dirname(filePath), { recursive: true });

  const lines = full.map((o) => JSON.stringify(o)).join("\n") + "\n";
  await appendFile(filePath, lines, "utf-8");

  return full;
}

/**
 * Read all observations from the JSONL file.
 * Returns empty array if file doesn't exist.
 */
export async function readObservations(
  dataDir: string,
): Promise<Observation[]> {
  const filePath = join(dataDir, OBSERVATIONS_PATH);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Observation);
}
