import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getSessionRepository } from "@/lib/services/session";
import { getItemService } from "@/lib/services/item";
import { getMemoryStore } from "./storage";
import { getMemoryService } from "./memory.service";
import type { MemoryStore } from "./storage/memory-store.interface";
import type { MemoryService } from "./memory.service";
import type {
  CreateMemoryInput,
  CreateEvidenceInput,
  CreateReflectionInput,
  CreateQuestionInput,
  Reflection,
} from "./types";
import {
  memoryTypes,
  confidenceLevels,
  curiosityTypes,
  questionTimings,
  relationshipTypes,
} from "./types";
import type { CreateConnectionInput } from "./types";
import type { Item } from "@/types";

// ============================================================================
// Extraction types
// ============================================================================

export interface ExtractedMemory {
  type: string;
  content: string;
  confidenceScore: number;
  confidenceLevel: string;
  evidence: string;
  tags: string[];
  existingMemoryId?: string;
  suggestedConnections?: { existingMemoryId: string; relationshipType: string }[];
}

export interface ExtractedQuestion {
  content: string;
  context: string;
  curiosityType: string;
  curiosityScore: number;
  timing: string;
  sourceMemoryIndices: number[];
}

export interface ExtractionResult {
  memories: ExtractedMemory[];
  questions: ExtractedQuestion[];
  metadata: {
    sessionId: string;
    messagesAnalyzed: number;
    modelUsed: string;
    durationMs: number;
  };
}

export interface ExtractionOptions {
  model?: { provider: string; modelId: string };
}

export interface ConfirmInput {
  sessionId: string;
  approvedMemories: (ExtractedMemory & { approved: boolean; edited?: Partial<CreateMemoryInput> })[];
  approvedQuestions: (ExtractedQuestion & { approved: boolean })[];
}

export interface ConfirmResult {
  memoriesSaved: number;
  questionsGenerated: number;
  reflection: Reflection;
}

// ============================================================================
// Extraction Service
// ============================================================================

const extractionSchema = z.object({
  memories: z.array(
    z.object({
      type: z.enum(memoryTypes),
      content: z.string(),
      confidenceScore: z.number().min(0).max(1),
      confidenceLevel: z.enum(confidenceLevels),
      evidence: z.string(),
      tags: z.array(z.string()),
      existingMemoryId: z.string().optional(),
      suggestedConnections: z
        .array(
          z.object({
            existingMemoryId: z.string(),
            relationshipType: z.enum(relationshipTypes),
          })
        )
        .optional(),
    })
  ),
  questions: z.array(
    z.object({
      content: z.string(),
      context: z.string(),
      curiosityType: z.enum(curiosityTypes),
      curiosityScore: z.number().min(0).max(1),
      timing: z.enum(questionTimings),
      sourceMemoryIndices: z.array(z.number()),
    })
  ),
});

export class ExtractionService {
  private static instance: ExtractionService | null = null;
  private store: MemoryStore;
  private memoryService: MemoryService;

  private constructor() {
    this.store = getMemoryStore();
    this.memoryService = getMemoryService();
  }

  static getInstance(): ExtractionService {
    if (!ExtractionService.instance) {
      ExtractionService.instance = new ExtractionService();
    }
    return ExtractionService.instance;
  }

  async extract(
    userId: string,
    sessionId: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    const start = Date.now();

    // 1. Load session and its root agent's items
    const sessionRepo = getSessionRepository();
    const session = await sessionRepo.findById(sessionId, userId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!session.rootAgentId) throw new Error(`Session has no root agent: ${sessionId}`);

    const itemService = getItemService();
    const items = await itemService.getByAgentId(session.rootAgentId);

    // 2. Format as transcript
    const transcript = this.formatTranscript(items);
    if (!transcript.trim()) {
      return {
        memories: [],
        questions: [],
        metadata: { sessionId, messagesAnalyzed: 0, modelUsed: "none", durationMs: Date.now() - start },
      };
    }

    // 3. Load existing memories for dedup context
    const existingMemories = await this.store.loadMemories(userId, { limit: 100, status: "active" });

    // 4. Build prompt and call LLM
    const defaultModel = { id: "extraction-default", name: "GPT-4o Mini", provider: "openai" as const, modelId: "gpt-4o-mini", maxContextTokens: 128000 };
    const modelConfig = options?.model
      ? { id: "extraction-custom", name: options.model.modelId, provider: options.model.provider as "openai" | "anthropic" | "google", modelId: options.model.modelId, maxContextTokens: 128000 }
      : defaultModel;
    const modelUsed = `${modelConfig.provider}/${modelConfig.modelId}`;
    const model = getLanguageModel(modelConfig);

    const existingContext = existingMemories.length > 0
      ? existingMemories
          .map((m) => `[${m.type}] (${m.id}) ${m.content}`)
          .join("\n")
      : "No existing memories yet.";

    const messagesAnalyzed = items.filter((i) => i.type === "message").length;

    const { object } = await generateObject({
      model,
      schema: extractionSchema,
      prompt: `You are analyzing a conversation to extract structured memories about the user.

## Existing Memories (do not duplicate these)
${existingContext}

## Conversation Transcript
${transcript}

## Instructions

Analyze the conversation and output JSON with two arrays: "memories" and "questions".

### Memories
For each piece of memorable information:
- type: fact | preference | relationship | principle | commitment | moment | skill
- content: Clear, concise single statement
- confidenceScore: 0.0-1.0
- confidenceLevel: explicit (0.95-1.0) | implied (0.70-0.94) | inferred (0.40-0.69) | speculative (0.00-0.39)
- evidence: Direct quote from conversation (max 200 chars)
- tags: Array of categorization tags
- existingMemoryId: If this updates/contradicts an existing memory, its ID (to supersede)
- suggestedConnections: Array of { existingMemoryId, relationshipType } for related existing memories. relationshipType must be one of: relates_to, contradicts, refines, supports, context_for

### Questions
For each knowledge gap or follow-up:
- content: Natural question (not clinical)
- context: Why this question emerged from the conversation
- curiosityType: gap | implication | clarification | exploration | connection
- curiosityScore: 0.0-1.0 (how important to ask)
- timing: next_session | when_relevant | low_priority
- sourceMemoryIndices: Which extracted memories (by index) triggered this question`,
    });

    return {
      memories: object.memories,
      questions: object.questions,
      metadata: {
        sessionId,
        messagesAnalyzed,
        modelUsed,
        durationMs: Date.now() - start,
      },
    };
  }

  async confirm(userId: string, input: ConfirmInput): Promise<ConfirmResult> {
    let memoriesSaved = 0;
    let questionsGenerated = 0;

    const connectionsToCreate: CreateConnectionInput[] = [];
    // Track mapping from original index in approvedMemories → saved memory ID
    const indexToMemoryId = new Map<number, string>();
    const approved = input.approvedMemories.filter((m) => m.approved);
    for (const mem of approved) {
      const memInput: CreateMemoryInput = {
        type: (mem.edited?.type ?? mem.type) as CreateMemoryInput["type"],
        content: mem.edited?.content ?? mem.content,
        confidenceScore: mem.edited?.confidenceScore ?? mem.confidenceScore,
        confidenceLevel: (mem.edited?.confidenceLevel ?? mem.confidenceLevel) as CreateMemoryInput["confidenceLevel"],
        tags: mem.edited?.tags ?? mem.tags,
        scope: mem.edited?.scope,
      };

      const evidence: CreateEvidenceInput = {
        sourceType: "session",
        sourceId: input.sessionId,
        excerpt: mem.evidence.slice(0, 200),
      };

      let savedMemoryId: string;
      if (mem.existingMemoryId) {
        const superseded = await this.memoryService.supersede(userId, mem.existingMemoryId, memInput);
        savedMemoryId = superseded.id;
      } else {
        const { memory } = await this.memoryService.create(userId, memInput, evidence);
        savedMemoryId = memory.id;
      }

      // Collect suggested connections for this memory
      if (mem.suggestedConnections?.length) {
        for (const conn of mem.suggestedConnections) {
          connectionsToCreate.push({
            fromMemoryId: savedMemoryId,
            toMemoryId: conn.existingMemoryId,
            relationshipType: conn.relationshipType as CreateConnectionInput["relationshipType"],
            strength: 0.5,
          });
        }
      }

      // Record original index → saved ID for question linking
      const originalIndex = input.approvedMemories.indexOf(mem);
      indexToMemoryId.set(originalIndex, savedMemoryId);

      memoriesSaved++;
    }

    // Create connections for approved memories
    if (connectionsToCreate.length > 0) {
      try {
        await this.store.addConnections(userId, connectionsToCreate);
      } catch {
        // Non-fatal: connections are supplementary
      }
    }

    // Persist approved questions with source memory links
    const approvedQuestions = input.approvedQuestions.filter((q) => q.approved);
    for (const q of approvedQuestions) {
      const questionInput: CreateQuestionInput = {
        content: q.content,
        context: q.context,
        curiosityType: q.curiosityType as CreateQuestionInput["curiosityType"],
        curiosityScore: q.curiosityScore,
        timing: q.timing as CreateQuestionInput["timing"],
      };

      // Resolve sourceMemoryIndices to real memory IDs
      const sourceMemoryIds = q.sourceMemoryIndices
        .map((idx) => indexToMemoryId.get(idx))
        .filter((id): id is string => !!id);

      try {
        await this.store.addQuestion(userId, questionInput, sourceMemoryIds);
        questionsGenerated++;
      } catch {
        // Non-fatal: question persistence is supplementary
      }
    }

    // Save reflection
    const reflectionInput: CreateReflectionInput = {
      sessionId: input.sessionId,
      memoriesExtracted: memoriesSaved,
      questionsGenerated,
      modelUsed: "confirmed-by-user",
      metadata: {
        totalProposed: input.approvedMemories.length,
        totalApproved: memoriesSaved,
        questionsProposed: input.approvedQuestions.length,
        questionsApproved: questionsGenerated,
      },
    };

    const reflection = await this.store.saveReflection(userId, reflectionInput);

    return { memoriesSaved, questionsGenerated, reflection };
  }

  private formatTranscript(items: Item[]): string {
    return items
      .filter((item) => item.type === "message" && item.content)
      .map((item) => {
        if (item.type === "message") {
          return `${item.role}: ${item.content}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
}

export function getExtractionService(): ExtractionService {
  return ExtractionService.getInstance();
}
