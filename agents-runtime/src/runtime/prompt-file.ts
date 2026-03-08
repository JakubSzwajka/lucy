import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_PROMPT_PATH = "./prompt.md";

export function readPromptFile(path: string = DEFAULT_PROMPT_PATH): string | null {
  const resolved = resolve(path);
  try {
    return readFileSync(resolved, "utf-8");
  } catch {
    console.warn(`[prompt-file] No prompt file found at ${resolved}`);
    return null;
  }
}
