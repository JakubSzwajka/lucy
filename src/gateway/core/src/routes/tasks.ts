import { readFile } from "node:fs/promises";
import path from "node:path";

import { Hono } from "hono";

const tasks = new Hono();

tasks.get("/tasks", async (c) => {
  const boardPath = path.resolve(process.cwd(), ".agents/tasks/board.json");
  try {
    const raw = await readFile(boardPath, "utf-8");
    const board = JSON.parse(raw);
    return c.json(board);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ version: 1, nextId: 1, tasks: [] });
    }
    throw err;
  }
});

export default tasks;
