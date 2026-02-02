import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  plans,
  planSteps,
  type PlanRecord,
  type NewPlan,
  type PlanStepRecord,
  type NewPlanStep,
  type PlanStatus,
  type PlanStepStatus,
} from "@/lib/db/schema";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface PlanWithSteps extends PlanRecord {
  steps: PlanStepRecord[];
}

export interface CreatePlanData {
  sessionId: string;
  agentId: string;
  title: string;
  description?: string;
  steps: Array<{ description: string }>;
}

export interface UpdatePlanData {
  title?: string;
  description?: string;
  status?: PlanStatus;
}

export interface AddStepData {
  description: string;
  afterStepId?: string;
}

export interface UpdateStepData {
  description?: string;
  status?: PlanStepStatus;
  result?: string;
  error?: string;
  assignedAgentId?: string;
}

// ============================================================================
// Plan Repository
// ============================================================================

export class PlanRepository {
  // ---------------------------------------------------------------------------
  // Plan Operations
  // ---------------------------------------------------------------------------

  /**
   * Get plan by ID with steps
   */
  findById(id: string): PlanWithSteps | null {
        const plan = db.select().from(plans).where(eq(plans.id, id)).get();
    if (!plan) return null;

    const steps = db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, id))
      .orderBy(asc(planSteps.sequence))
      .all();

    return { ...plan, steps };
  }

  /**
   * Get plan by session ID (one plan per session)
   */
  findBySessionId(sessionId: string): PlanWithSteps | null {
        const plan = db
      .select()
      .from(plans)
      .where(eq(plans.sessionId, sessionId))
      .get();

    if (!plan) return null;

    const steps = db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, plan.id))
      .orderBy(asc(planSteps.sequence))
      .all();

    return { ...plan, steps };
  }

  /**
   * Get plan by agent ID
   */
  findByAgentId(agentId: string): PlanWithSteps | null {
        const plan = db
      .select()
      .from(plans)
      .where(eq(plans.agentId, agentId))
      .get();

    if (!plan) return null;

    const steps = db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, plan.id))
      .orderBy(asc(planSteps.sequence))
      .all();

    return { ...plan, steps };
  }

  /**
   * Check if session already has a plan
   */
  existsForSession(sessionId: string): boolean {
        const plan = db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.sessionId, sessionId))
      .get();
    return !!plan;
  }

  /**
   * Create a new plan with steps
   */
  create(data: CreatePlanData): PlanWithSteps {
        const planId = nanoid();
    const now = new Date();

    const planData: NewPlan = {
      id: planId,
      sessionId: data.sessionId,
      agentId: data.agentId,
      title: data.title,
      description: data.description,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    db.insert(plans).values(planData).run();

    // Create steps
    const stepRecords: PlanStepRecord[] = [];
    for (let i = 0; i < data.steps.length; i++) {
      const stepId = nanoid();
      const stepData: NewPlanStep = {
        id: stepId,
        planId,
        sequence: i + 1,
        description: data.steps[i].description,
        status: "pending",
        createdAt: now,
      };
      db.insert(planSteps).values(stepData).run();
      stepRecords.push({
        ...stepData,
        assignedAgentId: null,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      } as PlanStepRecord);
    }

    return {
      ...planData,
      completedAt: null,
      steps: stepRecords,
    } as PlanWithSteps;
  }

  /**
   * Update plan metadata
   */
  update(id: string, data: UpdatePlanData): PlanWithSteps | null {
        const now = new Date();

    const updateData: Partial<PlanRecord> = {
      ...data,
      updatedAt: now,
    };

    if (data.status === "completed" || data.status === "failed") {
      updateData.completedAt = now;
    }

    db.update(plans).set(updateData).where(eq(plans.id, id)).run();

    return this.findById(id);
  }

  /**
   * Delete a plan
   */
  delete(id: string): boolean {
        const result = db.delete(plans).where(eq(plans.id, id)).run();
    return result.changes > 0;
  }

  // ---------------------------------------------------------------------------
  // Step Operations
  // ---------------------------------------------------------------------------

  /**
   * Get a step by ID
   */
  findStepById(stepId: string): PlanStepRecord | null {
        return db.select().from(planSteps).where(eq(planSteps.id, stepId)).get() ?? null;
  }

  /**
   * Add steps to a plan
   */
  addSteps(planId: string, steps: AddStepData[]): PlanStepRecord[] {
        const now = new Date();

    // Get current max sequence
    const existingSteps = db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence))
      .all();

    let insertAt = existingSteps.length;

    // If afterStepId is provided, find its position
    if (steps.length > 0 && steps[0].afterStepId) {
      const afterIdx = existingSteps.findIndex(s => s.id === steps[0].afterStepId);
      if (afterIdx !== -1) {
        insertAt = afterIdx + 1;
        // Shift sequences of steps after insert point
        for (let i = insertAt; i < existingSteps.length; i++) {
          db.update(planSteps)
            .set({ sequence: existingSteps[i].sequence + steps.length })
            .where(eq(planSteps.id, existingSteps[i].id))
            .run();
        }
      }
    }

    const newSteps: PlanStepRecord[] = [];
    for (let i = 0; i < steps.length; i++) {
      const stepId = nanoid();
      const stepData: NewPlanStep = {
        id: stepId,
        planId,
        sequence: insertAt + i + 1,
        description: steps[i].description,
        status: "pending",
        createdAt: now,
      };
      db.insert(planSteps).values(stepData).run();
      newSteps.push({
        ...stepData,
        assignedAgentId: null,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      } as PlanStepRecord);
    }

    // Update plan's updatedAt
    db.update(plans).set({ updatedAt: now }).where(eq(plans.id, planId)).run();

    return newSteps;
  }

  /**
   * Update a step
   */
  updateStep(stepId: string, data: UpdateStepData): PlanStepRecord | null {
        const now = new Date();

    const updateData: Partial<PlanStepRecord> = { ...data };

    if (data.status === "in_progress" && !updateData.startedAt) {
      updateData.startedAt = now;
    }

    if (data.status === "completed" || data.status === "failed" || data.status === "skipped") {
      updateData.completedAt = now;
    }

    db.update(planSteps).set(updateData).where(eq(planSteps.id, stepId)).run();

    // Get the step to find plan ID and update plan's updatedAt
    const step = this.findStepById(stepId);
    if (step) {
      db.update(plans).set({ updatedAt: now }).where(eq(plans.id, step.planId)).run();
    }

    return step;
  }

  /**
   * Remove steps from a plan
   */
  removeSteps(stepIds: string[]): void {
        const now = new Date();

    // Get plan ID from first step before deleting
    const firstStep = stepIds.length > 0 ? this.findStepById(stepIds[0]) : null;
    const planId = firstStep?.planId;

    for (const stepId of stepIds) {
      db.delete(planSteps).where(eq(planSteps.id, stepId)).run();
    }

    // Resequence remaining steps
    if (planId) {
      this.resequenceSteps(planId);
      db.update(plans).set({ updatedAt: now }).where(eq(plans.id, planId)).run();
    }
  }

  /**
   * Resequence steps to remove gaps
   */
  resequenceSteps(planId: string): void {
        const steps = db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence))
      .all();

    for (let i = 0; i < steps.length; i++) {
      if (steps[i].sequence !== i + 1) {
        db.update(planSteps)
          .set({ sequence: i + 1 })
          .where(eq(planSteps.id, steps[i].id))
          .run();
      }
    }
  }

  /**
   * Get all steps for a plan
   */
  getSteps(planId: string): PlanStepRecord[] {
        return db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence))
      .all();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: PlanRepository | null = null;

export function getPlanRepository(): PlanRepository {
  if (!instance) {
    instance = new PlanRepository();
  }
  return instance;
}
