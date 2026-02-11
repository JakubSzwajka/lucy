import { getMemoryStore } from "./storage";
import type { MemoryStore } from "./storage/memory-store.interface";
import type { Memory, Question, IdentityDocument } from "./types";
import { getItemService } from "@/lib/services/item";
import { getSessionService } from "@/lib/services/session";
import { getMemorySettings } from "./settings";

// ============================================================================
// Types
// ============================================================================

export interface ContextOptions {
  maxMemories?: number;
  minConfidence?: number;
  scope?: string;
  lastNMessages?: number;
}

export interface ContextResult {
  memories: Memory[];
  questions?: Question[];
  identity?: IdentityDocument | null;
}

// ============================================================================
// Context Retrieval Service
// ============================================================================

export class ContextRetrievalService {
  private static instance: ContextRetrievalService | null = null;
  private store: MemoryStore;

  private constructor() {
    this.store = getMemoryStore();
  }

  static getInstance(): ContextRetrievalService {
    if (!ContextRetrievalService.instance) {
      ContextRetrievalService.instance = new ContextRetrievalService();
    }
    return ContextRetrievalService.instance;
  }

  async getRelevantMemories(
    userId: string,
    sessionId: string,
    options: ContextOptions = {}
  ): Promise<ContextResult> {
    // Load user's memory settings for defaults
    const userSettings = await getMemorySettings(userId);

    const {
      maxMemories = userSettings.maxContextMemories,
      minConfidence = 0.4,
      lastNMessages = 5,
    } = options;

    // 1. Extract keywords from recent user messages
    const keywords = await this.extractKeywords(sessionId, userId, lastNMessages);

    // If no messages yet, fall back to loading recent high-confidence memories
    let candidates: Memory[];
    if (keywords.length === 0) {
      candidates = await this.store.loadMemories(userId, {
        status: "active",
        minConfidence,
        limit: maxMemories,
      });
    } else {
      // 2. Search by keywords
      const query = keywords.join(" ");
      candidates = await this.store.searchMemories(userId, query, {
        limit: maxMemories * 3, // fetch more than needed for ranking
        minConfidence,
      });

      // If search returns too few, supplement with recent high-confidence memories
      if (candidates.length < maxMemories) {
        const supplement = await this.store.loadMemories(userId, {
          status: "active",
          minConfidence,
          limit: maxMemories,
        });
        const existingIds = new Set(candidates.map((m) => m.id));
        for (const mem of supplement) {
          if (!existingIds.has(mem.id)) {
            candidates.push(mem);
          }
        }
      }
    }

    // 3. Graph expansion: pull in 1-hop connected memories
    const graphExpandedIds = new Set<string>();
    const existingIds = new Set(candidates.map((m) => m.id));
    const graphPromises = candidates.map((m) =>
      this.store.getGraph(userId, m.id, 1).catch(() => null)
    );
    const graphResults = await Promise.all(graphPromises);
    for (const result of graphResults) {
      if (!result) continue;
      for (const node of result.nodes) {
        if (!existingIds.has(node.id)) {
          existingIds.add(node.id);
          graphExpandedIds.add(node.id);
          candidates.push(node);
        }
      }
    }

    // 4. Filter to active only
    candidates = candidates.filter((m) => m.status === "active");

    // 5. Score and rank (graph-expanded memories get a distance penalty)
    const GRAPH_EXPANSION_PENALTY = 0.7;
    const now = Date.now();
    const scored = candidates.map((m) => ({
      memory: m,
      score:
        this.computeScore(m, options.scope, now) *
        (graphExpandedIds.has(m.id) ? GRAPH_EXPANSION_PENALTY : 1.0),
    }));

    scored.sort((a, b) => b.score - a.score);

    // 6. Dedup by content similarity
    const deduped = this.dedup(scored.map((s) => s.memory));

    // 7. Take top N
    const selected = deduped.slice(0, maxMemories);

    // 8. Touch all returned memories (fire-and-forget)
    for (const mem of selected) {
      this.store.touchMemory(userId, mem.id).catch(() => {});
    }

    // 9. Fetch pending questions to surface
    let questions: Question[] = [];
    try {
      questions = await this.store.getQuestionsToSurface(userId, userSettings.questionsPerSession);
    } catch {
      // Non-critical; continue without questions
    }

    // 10. Load identity document
    let identity: IdentityDocument | null = null;
    try {
      identity = await this.store.loadIdentity(userId);
    } catch {
      // Non-critical; continue without identity
    }

    return { memories: selected, questions, identity };
  }

  /**
   * Format memories as a system prompt section.
   * Returns null if no memories to inject.
   */
  formatMemoryContext(result: ContextResult): string | null {
    const { memories, questions = [], identity } = result;

    if (memories.length === 0 && questions.length === 0 && !identity?.content) return null;

    const sections: string[] = [];

    if (identity?.content) {
      const { values, growthNarrative } = identity.content;
      const lines: string[] = [];
      if (values.length > 0) lines.push(`Values: ${values.join(", ")}`);
      if (growthNarrative) lines.push(growthNarrative);
      if (lines.length > 0) {
        sections.push(`## Identity\n\n${lines.join("\n")}`);
      }
    }

    if (memories.length > 0) {
      const lines = memories.map(
        (m) => `[${m.type}] ${m.content} (confidence: ${m.confidenceScore.toFixed(2)})`
      );
      sections.push(`## What I Remember\n\n${lines.join("\n")}`);
    }

    if (questions.length > 0) {
      const qLines = questions.map((q) => `- ${q.content}`);
      sections.push(`## Things I've Been Wondering\n\n${qLines.join("\n")}`);
    }

    return sections.join("\n\n");
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async extractKeywords(
    sessionId: string,
    userId: string,
    lastN: number
  ): Promise<string[]> {
    try {
      const sessionService = getSessionService();
      const session = await sessionService.getById(sessionId, userId);
      if (!session?.rootAgentId) return [];

      const itemService = getItemService();
      const items = await itemService.getByAgentId(session.rootAgentId);

      // Filter to user messages, take last N
      const userMessages = items
        .filter((item) => item.type === "message" && item.role === "user")
        .slice(-lastN);

      if (userMessages.length === 0) return [];

      // Simple keyword extraction: split on whitespace, filter stop words & short words
      const text = userMessages
        .map((m) => (m.type === "message" ? m.content : "") || "")
        .join(" ");
      const words = text.toLowerCase().split(/\s+/);

      const stopWords = new Set([
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "can", "shall", "to", "of", "in", "for",
        "on", "with", "at", "by", "from", "as", "into", "about", "like",
        "through", "after", "over", "between", "out", "against", "during",
        "without", "before", "under", "around", "among", "it", "its", "this",
        "that", "these", "those", "i", "me", "my", "we", "our", "you", "your",
        "he", "him", "his", "she", "her", "they", "them", "their", "what",
        "which", "who", "when", "where", "why", "how", "all", "each", "every",
        "both", "few", "more", "most", "other", "some", "such", "no", "not",
        "only", "same", "so", "than", "too", "very", "just", "because", "but",
        "and", "or", "if", "then", "else", "while", "also", "any", "here",
        "there", "up", "down", "please", "thanks", "thank", "yes", "no", "ok",
        "okay", "sure", "hello", "hi", "hey",
      ]);

      const meaningful = words.filter(
        (w) => w.length > 2 && !stopWords.has(w) && /^[a-z]/.test(w)
      );

      // Deduplicate and take top keywords by frequency
      const freq = new Map<string, number>();
      for (const w of meaningful) {
        freq.set(w, (freq.get(w) || 0) + 1);
      }

      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);
    } catch {
      return [];
    }
  }

  private computeScore(memory: Memory, preferredScope: string | undefined, now: number): number {
    // Confidence component (0-1)
    const confidence = memory.confidenceScore;

    // Recency component (0-1): exponential decay over 30 days
    const msPerDay = 86400000;
    const daysSinceAccess = (now - memory.lastAccessedAt.getTime()) / msPerDay;
    const recency = Math.exp(-daysSinceAccess / 30);

    // Scope boost
    let scopeBoost = 1.0;
    if (preferredScope && memory.scope === preferredScope) {
      scopeBoost = 1.3;
    } else if (memory.scope === "global" || memory.scope === null) {
      scopeBoost = 1.1;
    } else {
      scopeBoost = 0.8;
    }

    return confidence * 0.5 + recency * 0.3 + (scopeBoost - 0.8) * 0.4;
  }

  private dedup(memories: Memory[]): Memory[] {
    const result: Memory[] = [];
    for (const mem of memories) {
      const isDuplicate = result.some(
        (existing) => this.similarity(existing.content, mem.content) > 0.8
      );
      if (!isDuplicate) {
        result.push(mem);
      }
    }
    return result;
  }

  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    return intersection.length / Math.max(wordsA.size, wordsB.size);
  }
}

export function getContextRetrievalService(): ContextRetrievalService {
  return ContextRetrievalService.getInstance();
}
