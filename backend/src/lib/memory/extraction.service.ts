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
import { getMemorySettings } from "./settings";

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
  existingMemoryId?: string | null;
  suggestedConnections?: { existingMemoryId: string; relationshipType: string }[] | null;
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
  /** Only extract from items at this index onward (for incremental/windowed extraction). */
  fromItemIndex?: number;
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
      existingMemoryId: z.string().nullable(),
      suggestedConnections: z
        .array(
          z.object({
            existingMemoryId: z.string(),
            relationshipType: z.enum(relationshipTypes),
          })
        )
        .nullable(),
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
    const allItems = await itemService.getByAgentId(session.rootAgentId);
    const items = options?.fromItemIndex ? allItems.slice(options.fromItemIndex) : allItems;

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

    // 3b. Load active questions for dedup context
    let activeQuestions: { id: string; content: string }[] = [];
    try {
      const questions = await this.store.getQuestionsToSurface(userId, 20);
      activeQuestions = questions.map((q) => ({ id: q.id, content: q.content }));
    } catch {
      // Non-critical
    }

    // 4. Build prompt and call LLM
    // Resolve model: explicit option > user setting > hardcoded default
    const userSettings = await getMemorySettings(userId);
    const fallbackModel = { id: "extraction-default", name: "GPT-4o Mini", provider: "openai" as const, modelId: "gpt-4o-mini", maxContextTokens: 128000 };
    let modelConfig: { id: string; name: string; provider: "openai" | "anthropic" | "google"; modelId: string; maxContextTokens: number };
    if (options?.model) {
      modelConfig = { id: "extraction-custom", name: options.model.modelId, provider: options.model.provider as "openai" | "anthropic" | "google", modelId: options.model.modelId, maxContextTokens: 128000 };
    } else if (userSettings.extractionModel) {
      // Format: "provider/modelId" e.g. "openai/gpt-4o-mini"
      const parts = userSettings.extractionModel.split("/");
      if (parts.length === 2) {
        modelConfig = { id: "extraction-setting", name: parts[1], provider: parts[0] as "openai" | "anthropic" | "google", modelId: parts[1], maxContextTokens: 128000 };
      } else {
        modelConfig = fallbackModel;
      }
    } else {
      modelConfig = fallbackModel;
    }
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
      experimental_telemetry: {
        isEnabled: true,
        functionId: "memory-extraction",
        metadata: { sessionId, userId, model: modelUsed, messagesAnalyzed },
      },
      prompt: `You are analyzing a conversation to extract structured memories about the user.

## Existing Memories (do not duplicate these)
${existingContext}

## Active Questions (do not regenerate these)
${activeQuestions.length > 0 ? activeQuestions.map((q) => `[${q.id}] ${q.content}`).join("\n") : "No active questions yet."}

## Conversation Transcript
${transcript}

## Instructions

Analyze the conversation and output JSON with two arrays: "memories" and "questions".

### Memory Rules
ONLY extract facts about the USER — their life, goals, preferences, relationships, decisions, skills, patterns, personality. NEVER extract facts about the AI assistant's architecture, features, capabilities, or implementation details. Those belong in code and documentation, not user memory.

DEDUPLICATION IS MANDATORY. Before proposing any memory:
1. Check the existing memories list above carefully
2. If an existing memory covers >80% of the same information, either: a) SKIP it entirely, OR b) Set existingMemoryId to UPDATE/SUPERSEDE it with refined content
3. When in doubt, DON'T save. Fewer high-quality memories beat many redundant ones.

Apply the "useful in 30 days" test: Will this memory help serve the user better a month from now? If no, don't extract it.

GOOD: "Kuba works at Sofomo" (durable fact)
GOOD: "Kuba prefers building to understand, not reading docs" (personality pattern)
GOOD: "Kuba is getting married to Domi in 2026" (major life event)
BAD: "Domi is working right now" (ephemeral, only true this moment)
BAD: "Kuba didn't work yesterday" (one-time event, no lasting value)
BAD: "Anthropic API was down today" (incident, not user knowledge)
BAD: "Lucy now supports vision" (AI feature, not user knowledge)
BAD: "Messages should include timestamps" (implementation detail)

Maximum 5 new memories per extraction. Force-rank by importance. Quality over quantity.
Set confidenceScore honestly. Don't inflate scores to pass the auto-save threshold.

### Memory Schema
- type: fact | preference | relationship | principle | commitment | moment | skill
- content: Clear, concise single statement
- confidenceScore: 0.0-1.0
- confidenceLevel: explicit (0.95-1.0) | implied (0.70-0.94) | inferred (0.40-0.69) | speculative (0.00-0.39)
- evidence: Direct quote from conversation (max 200 chars)
- tags: Array of categorization tags
- existingMemoryId: If this updates/contradicts an existing memory, its ID (to supersede). Null otherwise.
- suggestedConnections: Array of { existingMemoryId, relationshipType } for related existing memories. relationshipType must be one of: relates_to, contradicts, refines, supports, context_for

### Question Rules
Questions must be about the USER — their motivations, goals, blind spots, patterns, relationships, experiences. NEVER generate meta-questions about the reflection process, memory system, AI capabilities, or how to improve the AI itself.

Do NOT regenerate questions that overlap with the Active Questions listed above. Generate NEW questions that fill genuine knowledge gaps only.

Apply the "would I actually ask this in conversation?" test. If the question sounds like a survey, a therapist intake form, or navel-gazing, rephrase it or drop it.

GOOD: "What does Kuba's typical workday look like?"
GOOD: "What is Domi's profession?"
BAD: "What new questions might arise from recent conversations?"
BAD: "How can we ensure memory extraction captures relevant details?"
BAD: "What improvements can be made to the reflection process?"

Maximum 3 questions per extraction. Prioritize genuine curiosity gaps about the user.
Questions should be SPECIFIC and ANSWERABLE in conversation, not abstract or philosophical.

### Question Schema
- content: Natural question (not clinical)
- context: Why this question emerged from the conversation
- curiosityType: gap | implication | clarification | exploration | connection
- curiosityScore: 0.0-1.0 (how important to ask)
- timing: next_session | when_relevant | low_priority
- sourceMemoryIndices: Which extracted memories (by index) triggered this question

### Critical Rule: Empty output is valid
If the conversation is primarily about the AI assistant's own 
architecture, implementation, debugging, or development — extract 
NOTHING. Return: { "memories": [], "questions": [] }

This is the CORRECT response when the conversation doesn't contain 
new personal information about the user. Do not force extraction.
Most conversations about technical implementation of the AI system 
should produce zero memories and zero questions.


`,
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

    // Load existing memories for write-time dedup
    const existingMemories = await this.store.loadMemories(userId, { limit: 100, status: "active" });

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
        // Write-time dedup: skip if too similar to an existing memory
        const isDuplicate = existingMemories.some(
          (existing) => this.wordOverlapSimilarity(existing.content, memInput.content) > 0.8
        );
        if (isDuplicate) {
          console.log(`[extraction] Skipping duplicate memory: "${memInput.content.slice(0, 80)}"`);
          continue;
        }
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

  private wordOverlapSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    return intersection.length / Math.max(wordsA.size, wordsB.size);
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
