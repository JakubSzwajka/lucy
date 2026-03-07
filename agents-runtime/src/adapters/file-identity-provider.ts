import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IdentityProvider } from "../ports.js";
import type { IdentityDocument } from "../types.js";

export class FileIdentityProvider implements IdentityProvider {
  constructor(private dataDir: string = ".agents-data") {}

  async getActive(userId: string): Promise<IdentityDocument | null> {
    const filePath = join(this.dataDir, "identity", `${userId}.json`);
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as IdentityDocument;
    } catch {
      return null;
    }
  }
}
