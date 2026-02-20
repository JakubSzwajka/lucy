import {
  PlanRepository,
  getPlanRepository,
  type PlanWithSteps,
  type UpdatePlanData,
  type AddStepData,
} from "./plan.repository";
import type { PlanStatus, PlanStepRecord, PlanStepStatus } from "@/lib/db/schema";

// ============================================================================
// Service Types
// ============================================================================

export interface CreatePlanInput {
  sessionId: string;
  agentId: string;
  title: string;
  description?: string;
  steps: Array<{ description: string }>;
}

export interface UpdatePlanInput {
  title?: string;
  description?: string;
  status?: PlanStatus;
  addSteps?: AddStepData[];
  updateSteps?: Array<{
    stepId: string;
    description?: string;
    status?: PlanStepStatus;
    result?: string;
    error?: string;
  }>;
  removeSteps?: string[];
}

export interface CreatePlanResult {
  plan?: PlanWithSteps;
  error?: string;
}

export interface UpdatePlanResult {
  plan?: PlanWithSteps;
  error?: string;
  notFound?: boolean;
}

// ============================================================================
// Plan Service
// ============================================================================

export class PlanService {
  private repository: PlanRepository;

  constructor(repository?: PlanRepository) {
    this.repository = repository || getPlanRepository();
  }

  async getById(id: string, userId: string): Promise<PlanWithSteps | null> {
    return this.repository.findById(id, userId);
  }

  async getBySessionId(sessionId: string, userId: string): Promise<PlanWithSteps | null> {
    return this.repository.findBySessionId(sessionId, userId);
  }

  async getByAgentId(agentId: string, userId: string): Promise<PlanWithSteps | null> {
    return this.repository.findByAgentId(agentId, userId);
  }

  async hasplan(sessionId: string, userId: string): Promise<boolean> {
    return this.repository.existsForSession(sessionId, userId);
  }

  async create(data: CreatePlanInput, userId: string): Promise<CreatePlanResult> {
    if (await this.repository.existsForSession(data.sessionId, userId)) {
      return {
        error: "Session already has a plan. Use update_plan to modify it.",
      };
    }

    if (data.steps.length === 0) {
      return { error: "Plan must have at least one step." };
    }

    const plan = await this.repository.create({
      sessionId: data.sessionId,
      agentId: data.agentId,
      title: data.title,
      description: data.description,
      steps: data.steps,
    }, userId);

    return { plan };
  }

  async update(planId: string, input: UpdatePlanInput, userId: string): Promise<UpdatePlanResult> {
    const plan = await this.repository.findById(planId, userId);
    if (!plan) {
      return { notFound: true };
    }

    if (input.removeSteps && input.removeSteps.length > 0) {
      await this.repository.removeSteps(input.removeSteps);
    }

    if (input.updateSteps && input.updateSteps.length > 0) {
      for (const stepUpdate of input.updateSteps) {
        const { stepId, ...data } = stepUpdate;
        await this.repository.updateStep(stepId, data);
      }
    }

    if (input.addSteps && input.addSteps.length > 0) {
      await this.repository.addSteps(planId, input.addSteps);
    }

    const planUpdate: UpdatePlanData = {};
    if (input.title !== undefined) planUpdate.title = input.title;
    if (input.description !== undefined) planUpdate.description = input.description;

    const updatedPlan = await this.repository.findById(planId, userId);
    if (updatedPlan) {
      const derivedStatus = input.status || this.derivePlanStatus(updatedPlan.steps);
      planUpdate.status = derivedStatus;
    }

    if (Object.keys(planUpdate).length > 0) {
      await this.repository.update(planId, planUpdate, userId);
    }

    return { plan: (await this.repository.findById(planId, userId)) ?? undefined };
  }

  async delete(planId: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(planId, userId);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  async completeStep(stepId: string, userId: string, result?: string): Promise<UpdatePlanResult> {
    const step = await this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    await this.repository.updateStep(stepId, {
      status: "completed",
      result,
    });

    return this.update(step.planId, {}, userId);
  }

  async failStep(stepId: string, error: string, userId: string): Promise<UpdatePlanResult> {
    const step = await this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    await this.repository.updateStep(stepId, {
      status: "failed",
      error,
    });

    return this.update(step.planId, {}, userId);
  }

  async startStep(stepId: string, userId: string): Promise<UpdatePlanResult> {
    const step = await this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    await this.repository.updateStep(stepId, {
      status: "in_progress",
    });

    return this.update(step.planId, {}, userId);
  }

  private derivePlanStatus(steps: PlanStepRecord[]): PlanStatus {
    if (steps.length === 0) return "pending";

    const statuses = steps.map(s => s.status);

    if (statuses.includes("failed")) return "failed";
    if (statuses.every(s => s === "completed" || s === "skipped")) return "completed";
    if (statuses.includes("in_progress")) return "in_progress";
    if (statuses.includes("completed") && statuses.includes("pending")) return "in_progress";

    return "pending";
  }

  async getProgress(planId: string, userId: string): Promise<{ completed: number; total: number; percentage: number } | null> {
    const plan = await this.repository.findById(planId, userId);
    if (!plan) return null;

    const total = plan.steps.length;
    const completed = plan.steps.filter(
      s => s.status === "completed" || s.status === "skipped"
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: PlanService | null = null;

export function getPlanService(): PlanService {
  if (!instance) {
    instance = new PlanService();
  }
  return instance;
}
