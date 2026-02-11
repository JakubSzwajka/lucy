import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import { getMemoryService } from "@/lib/memory";
import { memoryTypes, confidenceLevels } from "@/lib/memory/types";

export const continuityModule = defineToolModule<null>({
  id: "continuity",
  name: "Continuity",
  description: "Structured memory with confidence scoring",
  integrationId: null,

  createTools: () => [
    defineTool({
      name: "continuity",
      description: `Store and recall structured knowledge about the user.

ACTIONS:
- "save": Store a new memory with type and confidence scoring
- "find": Search memories by keyword
- "update": Modify an existing memory's content, type, or confidence
- "supersede": Replace an outdated memory with a corrected version

MEMORY TYPES: fact, preference, relationship, principle, commitment, moment, skill

CONFIDENCE LEVELS:
- explicit (0.95-1.0): User stated directly
- implied (0.70-0.94): Strongly suggested by context
- inferred (0.40-0.69): Reasonable deduction
- speculative (0.00-0.39): Guess based on limited evidence

WHEN TO SAVE:
- User shares personal info, preferences, or experiences
- User corrects a previous assumption
- Important context about projects, relationships, or goals
- Skills, tools, or technologies the user works with

Always set appropriate confidence based on how the information was obtained.`,

      inputSchema: z.object({
        action: z.enum(["save", "find", "update", "supersede"]).describe("Action to perform"),

        // For save
        type: z.enum(memoryTypes).optional().describe("Memory type"),
        content: z.string().optional().describe("Memory content - clear, concise statement"),
        confidenceScore: z.number().min(0).max(1).optional().describe("Confidence 0.0-1.0"),
        confidenceLevel: z.enum(confidenceLevels).optional().describe("Confidence tier"),
        tags: z.array(z.string()).optional().describe("Categorization tags"),
        scope: z.string().optional().describe("Scope: 'global' or 'project:<name>'"),

        // For find
        query: z.string().optional().describe("Search keywords"),

        // For update / supersede
        memoryId: z.string().optional().describe("ID of memory to update or supersede"),

        // For update - partial fields
        updates: z.object({
          content: z.string().optional(),
          type: z.enum(memoryTypes).optional(),
          confidenceScore: z.number().min(0).max(1).optional(),
          confidenceLevel: z.enum(confidenceLevels).optional(),
          tags: z.array(z.string()).optional(),
          scope: z.string().optional(),
        }).optional().describe("Fields to update"),
      }),

      source: { type: "builtin", moduleId: "continuity" },

      execute: async (args, context) => {
        const service = getMemoryService();
        const { userId } = context;

        // ========== SAVE ==========
        if (args.action === "save") {
          const { type, content, confidenceScore, confidenceLevel, tags, scope } = args;

          if (!type) return { error: "type is required for save" };
          if (!content) return { error: "content is required for save" };
          if (confidenceScore === undefined) return { error: "confidenceScore is required for save" };
          if (!confidenceLevel) return { error: "confidenceLevel is required for save" };

          const result = await service.create(userId, {
            type,
            content,
            confidenceScore,
            confidenceLevel,
            tags,
            scope,
          }, {
            sourceType: "session",
            sourceId: context.sessionId,
            excerpt: content.slice(0, 200),
          });

          return {
            success: true,
            memory: {
              id: result.memory.id,
              type: result.memory.type,
              content: result.memory.content,
              confidenceScore: result.memory.confidenceScore,
              confidenceLevel: result.memory.confidenceLevel,
            },
            ...(result.duplicateWarning ? { warning: result.duplicateWarning } : {}),
          };
        }

        // ========== FIND ==========
        if (args.action === "find") {
          const { query } = args;
          if (!query) return { error: "query is required for find" };

          const memories = await service.search(userId, query);

          return {
            memories: memories.map((m) => ({
              id: m.id,
              type: m.type,
              content: m.content,
              confidenceScore: m.confidenceScore,
              confidenceLevel: m.confidenceLevel,
              tags: m.tags,
              scope: m.scope,
              status: m.status,
            })),
            count: memories.length,
          };
        }

        // ========== UPDATE ==========
        if (args.action === "update") {
          const { memoryId, updates: updateData } = args;
          if (!memoryId) return { error: "memoryId is required for update" };
          if (!updateData) return { error: "updates object is required for update" };

          const memory = await service.update(userId, memoryId, updateData);

          return {
            success: true,
            memory: {
              id: memory.id,
              type: memory.type,
              content: memory.content,
              confidenceScore: memory.confidenceScore,
              confidenceLevel: memory.confidenceLevel,
            },
          };
        }

        // ========== SUPERSEDE ==========
        if (args.action === "supersede") {
          const { memoryId, type, content, confidenceScore, confidenceLevel, tags, scope } = args;
          if (!memoryId) return { error: "memoryId is required for supersede" };
          if (!type) return { error: "type is required for supersede" };
          if (!content) return { error: "content is required for supersede" };
          if (confidenceScore === undefined) return { error: "confidenceScore is required for supersede" };
          if (!confidenceLevel) return { error: "confidenceLevel is required for supersede" };

          const memory = await service.supersede(userId, memoryId, {
            type,
            content,
            confidenceScore,
            confidenceLevel,
            tags,
            scope,
          });

          return {
            success: true,
            superseded: memoryId,
            newMemory: {
              id: memory.id,
              type: memory.type,
              content: memory.content,
              confidenceScore: memory.confidenceScore,
              confidenceLevel: memory.confidenceLevel,
            },
          };
        }

        return { error: `Unknown action: ${args.action}` };
      },
    }),
  ],
});
