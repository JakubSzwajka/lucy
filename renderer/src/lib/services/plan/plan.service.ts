import {
  PlanRepository,
  getPlanRepository,
  type PlanWithSteps,
  type CreatePlanData,
  type UpdatePlanData,
  type AddStepData,
  type UpdateStepData,
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

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  /**
   * Get plan by ID
   */
  getById(id: string): PlanWithSteps | null {
    return this.repository.findById(id);
  }

  /**
   * Get plan for a session
   */
  getBySessionId(sessionId: string): PlanWithSteps | null {
    return this.repository.findBySessionId(sessionId);
  }

  /**
   * Get plan owned by an agent
   */
  getByAgentId(agentId: string): PlanWithSteps | null {
    return this.repository.findByAgentId(agentId);
  }

  /**
   * Check if session has a plan
   */
  hasplan(sessionId: string): boolean {
    return this.repository.existsForSession(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Create Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new plan (one per session enforced)
   */
  create(data: CreatePlanInput): CreatePlanResult {
    // Check if session already has a plan
    if (this.repository.existsForSession(data.sessionId)) {
      return {
        error: "Session already has a plan. Use update_plan to modify it.",
      };
    }

    if (data.steps.length === 0) {
      return { error: "Plan must have at least one step." };
    }

    const plan = this.repository.create({
      sessionId: data.sessionId,
      agentId: data.agentId,
      title: data.title,
      description: data.description,
      steps: data.steps,
    });

    return { plan };
  }

  // ---------------------------------------------------------------------------
  // Update Operations
  // ---------------------------------------------------------------------------

  /**
   * Update a plan (handles all modifications)
   */
  update(planId: string, input: UpdatePlanInput): UpdatePlanResult {
    const plan = this.repository.findById(planId);
    if (!plan) {
      return { notFound: true };
    }

    // 1. Remove steps first (so sequence updates work correctly)
    if (input.removeSteps && input.removeSteps.length > 0) {
      this.repository.removeSteps(input.removeSteps);
    }

    // 2. Update existing steps
    if (input.updateSteps && input.updateSteps.length > 0) {
      for (const stepUpdate of input.updateSteps) {
        const { stepId, ...data } = stepUpdate;
        this.repository.updateStep(stepId, data);
      }
    }

    // 3. Add new steps
    if (input.addSteps && input.addSteps.length > 0) {
      this.repository.addSteps(planId, input.addSteps);
    }

    // 4. Update plan metadata
    const planUpdate: UpdatePlanData = {};
    if (input.title !== undefined) planUpdate.title = input.title;
    if (input.description !== undefined) planUpdate.description = input.description;

    // 5. Calculate and update plan status
    const updatedPlan = this.repository.findById(planId);
    if (updatedPlan) {
      const derivedStatus = input.status || this.derivePlanStatus(updatedPlan.steps);
      planUpdate.status = derivedStatus;
    }

    if (Object.keys(planUpdate).length > 0) {
      this.repository.update(planId, planUpdate);
    }

    return { plan: this.repository.findById(planId) ?? undefined };
  }

  /**
   * Delete a plan
   */
  delete(planId: string): { success: boolean; notFound?: boolean } {
    const deleted = this.repository.delete(planId);
    if (!deleted) {
      return { success: false, notFound: true };
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods
  // ---------------------------------------------------------------------------

  /**
   * Complete a step
   */
  completeStep(stepId: string, result?: string): UpdatePlanResult {
    const step = this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    this.repository.updateStep(stepId, {
      status: "completed",
      result,
    });

    return this.update(step.planId, {});
  }

  /**
   * Fail a step
   */
  failStep(stepId: string, error: string): UpdatePlanResult {
    const step = this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    this.repository.updateStep(stepId, {
      status: "failed",
      error,
    });

    return this.update(step.planId, {});
  }

  /**
   * Start a step (mark as in_progress)
   */
  startStep(stepId: string): UpdatePlanResult {
    const step = this.repository.findStepById(stepId);
    if (!step) {
      return { error: "Step not found" };
    }

    this.repository.updateStep(stepId, {
      status: "in_progress",
    });

    return this.update(step.planId, {});
  }

  // ---------------------------------------------------------------------------
  // Status Derivation
  // ---------------------------------------------------------------------------

  /**
   * Derive plan status from step statuses
   */
  private derivePlanStatus(steps: PlanStepRecord[]): PlanStatus {
    if (steps.length === 0) return "pending";

    const statuses = steps.map(s => s.status);

    // Any failed → failed
    if (statuses.includes("failed")) return "failed";

    // All completed or skipped → completed
    if (statuses.every(s => s === "completed" || s === "skipped")) return "completed";

    // Any in_progress → in_progress
    if (statuses.includes("in_progress")) return "in_progress";

    // Some completed, some pending → in_progress
    if (statuses.includes("completed") && statuses.includes("pending")) return "in_progress";

    return "pending";
  }

  /**
   * Get progress stats for a plan
   */
  getProgress(planId: string): { completed: number; total: number; percentage: number } | null {
    const plan = this.repository.findById(planId);
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
