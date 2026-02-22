import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import { getMemoryService } from "@/lib/server/memory";
import { getQuestionService } from "@/lib/server/memory/question.service";
import { memoryTypes, confidenceLevels, questionStatuses, questionTimings } from "@/lib/server/memory/types";

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
- "list": Browse all memories with optional filters (type, scope, limit, offset)
- "update": Modify an existing memory's content, type, or confidence
- "supersede": Replace an outdated memory with a corrected version
- "delete": Permanently remove a memory by ID (use when information is wrong, irrelevant, or user asks to forget)
- "list_tags": List all tags currently used across memories. Prefer reusing existing tags when saving new memories — fewer, well-connected tags build stronger links between memories. You are not limited to existing tags though; create new ones when nothing fits.
- "list_questions": Browse pending or resolved questions with optional filters (status, timing, scope, limit, offset)
- "resolve_question": Mark a surfaced question as answered (requires questionId and answer)

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

TAG FORMAT:
- Always lowercase, hyphens instead of spaces (e.g. "machine-learning", "tech-stack", "work-philosophy")
- Tags are auto-normalized server-side, but prefer sending them in the correct format
- Use list_tags to see existing tags before creating new ones
- Reuse existing tags whenever possible — fewer, well-connected tags make the memory graph more useful
- Only create a new tag when no existing tag fits

Always set appropriate confidence based on how the information was obtained.`,

      inputSchema: z.object({
        action: z.enum(["save", "find", "list", "update", "supersede", "delete", "list_tags", "list_questions", "resolve_question"]).describe("Action to perform"),

        // For save
        type: z.enum(memoryTypes).optional().describe("Memory type"),
        content: z.string().optional().describe("Memory content - clear, concise statement"),
        confidenceScore: z.number().min(0).max(1).optional().describe("Confidence 0.0-1.0"),
        confidenceLevel: z.enum(confidenceLevels).optional().describe("Confidence tier"),
        tags: z.array(z.string()).optional().describe("Categorization tags (lowercase, hyphens instead of spaces, e.g. 'machine-learning')"),
        scope: z.string().optional().describe("Scope: 'global' or 'project:<name>'"),

        // For find
        query: z.string().optional().describe("Search keywords"),

        // For list
        limit: z.number().min(1).max(100).optional().describe("Max results (default 50)"),
        offset: z.number().min(0).optional().describe("Pagination offset (default 0)"),

        // For update / supersede
        memoryId: z.string().optional().describe("ID of memory to update or supersede"),

        // For list_questions
        questionStatus: z.enum(questionStatuses).optional().describe("Filter questions by status (default: pending)"),
        questionTiming: z.enum(questionTimings).optional().describe("Filter questions by timing"),

        // For resolve_question
        questionId: z.string().optional().describe("ID of the question to resolve"),
        answer: z.string().optional().describe("The answer that resolves the question"),

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

        // Normalize tags: lowercase, spaces → hyphens, deduplicate
        const normalizeTags = (tags?: string[]): string[] | undefined =>
          tags?.map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);

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
            tags: normalizeTags(tags),
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

        // ========== LIST ==========
        if (args.action === "list") {
          const memories = await service.list(userId, {
            type: args.type || undefined,
            scope: args.scope || undefined,
            status: "active",
            limit: Math.min(args.limit ?? 50, 100),
            offset: args.offset ?? 0,
          });

          return {
            memories: memories.map((m) => ({
              id: m.id,
              type: m.type,
              content: m.content,
              scope: m.scope,
              confidenceLevel: m.confidenceLevel,
              confidenceScore: m.confidenceScore,
              tags: m.tags,
              createdAt: m.createdAt.toISOString(),
            })),
            count: memories.length,
          };
        }

        // ========== UPDATE ==========
        if (args.action === "update") {
          const { memoryId, updates: updateData } = args;
          if (!memoryId) return { error: "memoryId is required for update" };
          if (!updateData) return { error: "updates object is required for update" };

          const normalized = updateData.tags ? { ...updateData, tags: normalizeTags(updateData.tags) } : updateData;
          const memory = await service.update(userId, memoryId, normalized);

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
            tags: normalizeTags(tags),
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

        // ========== DELETE ==========
        if (args.action === "delete") {
          const { memoryId } = args;
          if (!memoryId) return { error: "memoryId is required for delete" };

          await service.delete(userId, memoryId);

          return { success: true, deleted: memoryId };
        }

        // ========== LIST TAGS ==========
        if (args.action === "list_tags") {
          const tags = await service.getDistinctTags(userId);

          return {
            tags,
            count: tags.length,
          };
        }

        // ========== LIST QUESTIONS ==========
        if (args.action === "list_questions") {
          const questionService = getQuestionService();
          const questions = await questionService.list(userId, {
            status: args.questionStatus || undefined,
            timing: args.questionTiming || undefined,
            scope: args.scope || undefined,
            limit: Math.min(args.limit ?? 50, 100),
            offset: args.offset ?? 0,
          });

          return {
            questions: questions.map((q) => ({
              id: q.id,
              content: q.content,
              context: q.context,
              curiosityType: q.curiosityType,
              curiosityScore: q.curiosityScore,
              timing: q.timing,
              scope: q.scope,
              status: q.status,
              answer: q.answer,
              createdAt: q.createdAt.toISOString(),
            })),
            count: questions.length,
          };
        }

        // ========== RESOLVE QUESTION ==========
        if (args.action === "resolve_question") {
          const { questionId, answer } = args;
          if (!questionId) return { error: "questionId is required for resolve_question" };
          if (!answer) return { error: "answer is required for resolve_question" };

          const questionService = getQuestionService();
          const resolved = await questionService.resolve(userId, questionId, { answer });

          return {
            success: true,
            question: {
              id: resolved.id,
              content: resolved.content,
              status: resolved.status,
              answer: resolved.answer,
            },
          };
        }

        return { error: `Unknown action: ${args.action}` };
      },
    }),
  ],
});
