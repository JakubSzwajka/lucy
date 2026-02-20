import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getMemoryStore } from "./storage";
import type { MemoryStore } from "./storage/memory-store.interface";
import type { IdentityDocument, IdentityContent, Memory } from "./types";
import { memoryTypes } from "./types";

const identityContentSchema = z.object({
  values: z.array(z.string()),
  capabilities: z.array(z.string()),
  growthNarrative: z.string(),
  keyRelationships: z.array(
    z.object({
      name: z.string(),
      nature: z.string(),
    })
  ),
});

export class IdentityService {
  private static instance: IdentityService | null = null;
  private store: MemoryStore;

  private constructor() {
    this.store = getMemoryStore();
  }

  static getInstance(): IdentityService {
    if (!IdentityService.instance) {
      IdentityService.instance = new IdentityService();
    }
    return IdentityService.instance;
  }

  async getActive(userId: string): Promise<IdentityDocument | null> {
    return this.store.loadIdentity(userId);
  }

  async generate(userId: string): Promise<IdentityDocument> {
    // Load all active memories
    const allMemories = await this.store.loadMemories(userId, { status: "active", limit: 500 });

    // Group by type
    const grouped: Record<string, Memory[]> = {};
    for (const type of memoryTypes) {
      const ofType = allMemories.filter((m) => m.type === type);
      if (ofType.length > 0) {
        grouped[type] = ofType;
      }
    }

    const memoriesText = Object.entries(grouped)
      .map(([type, mems]) => {
        const lines = mems.map((m) => `- ${m.content}`).join("\n");
        return `### ${type}\n${lines}`;
      })
      .join("\n\n");

    const model = getLanguageModel({
      id: "identity-synthesis",
      name: "GPT-4o Mini",
      provider: "openrouter" as const,
      modelId: "openai/gpt-4o-mini",
      maxContextTokens: 128000,
    });

    const { object } = await generateObject({
      model,
      schema: identityContentSchema,
      prompt: `Given these memories about a user, synthesize an identity document.

## Memories
${memoriesText || "No memories yet."}

Output a JSON object with:
- "values": Array of value statements that reflect the user's core values and beliefs
- "capabilities": Array of capabilities, skills, and expertise areas
- "growthNarrative": A paragraph describing the user's evolution and growth over time
- "keyRelationships": Array of { "name", "nature" } for important people mentioned`,
    });

    const content: IdentityContent = object;
    return this.store.updateIdentity(userId, content);
  }

  async listVersions(userId: string): Promise<IdentityDocument[]> {
    return this.store.listIdentityVersions(userId);
  }
}

export function getIdentityService(): IdentityService {
  return IdentityService.getInstance();
}
