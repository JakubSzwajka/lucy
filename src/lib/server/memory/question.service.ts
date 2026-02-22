import { getMemoryStore } from "./storage";
import type { MemoryStore } from "./storage/memory-store.interface";
import type {
  Question,
  QuestionFilters,
  QuestionResolution,
} from "./types";

export class QuestionService {
  private static instance: QuestionService | null = null;
  private store: MemoryStore;

  private constructor() {
    this.store = getMemoryStore();
  }

  static getInstance(): QuestionService {
    if (!QuestionService.instance) {
      QuestionService.instance = new QuestionService();
    }
    return QuestionService.instance;
  }

  async getPendingForSession(userId: string, sessionScope: string, limit = 5): Promise<Question[]> {
    const scoped = await this.store.loadQuestions(userId, {
      status: "pending",
      scope: sessionScope,
      limit,
    });

    if (scoped.length >= limit) return scoped;

    // Fill remaining slots with top unscoped pending questions
    const remaining = limit - scoped.length;
    const top = await this.store.getQuestionsToSurface(userId, remaining + scoped.length);

    // Deduplicate
    const ids = new Set(scoped.map((q) => q.id));
    for (const q of top) {
      if (!ids.has(q.id) && scoped.length < limit) {
        scoped.push(q);
        ids.add(q.id);
      }
    }

    return scoped;
  }

  async resolve(userId: string, questionId: string, resolution: QuestionResolution): Promise<Question> {
    return this.store.resolveQuestion(userId, questionId, resolution);
  }

  async list(userId: string, filters?: QuestionFilters): Promise<Question[]> {
    return this.store.loadQuestions(userId, filters);
  }

  async delete(userId: string, questionId: string): Promise<void> {
    return this.store.deleteQuestion(userId, questionId);
  }
}

export function getQuestionService(): QuestionService {
  return QuestionService.getInstance();
}
