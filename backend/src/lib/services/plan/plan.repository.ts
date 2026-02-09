import { eq, asc, and } from "drizzle-orm";
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
  async findById(id: string, userId: string): Promise<PlanWithSteps | null> {
    const [plan] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
    if (!plan) return null;

    const steps = await db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, id))
      .orderBy(asc(planSteps.sequence));

    return { ...plan, steps };
  }

  async findBySessionId(sessionId: string, userId: string): Promise<PlanWithSteps | null> {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.sessionId, sessionId), eq(plans.userId, userId)));

    if (!plan) return null;

    const steps = await db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, plan.id))
      .orderBy(asc(planSteps.sequence));

    return { ...plan, steps };
  }

  async findByAgentId(agentId: string, userId: string): Promise<PlanWithSteps | null> {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.agentId, agentId), eq(plans.userId, userId)));

    if (!plan) return null;

    const steps = await db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, plan.id))
      .orderBy(asc(planSteps.sequence));

    return { ...plan, steps };
  }

  async existsForSession(sessionId: string, userId: string): Promise<boolean> {
    const [plan] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.sessionId, sessionId), eq(plans.userId, userId)));
    return !!plan;
  }

  async create(data: CreatePlanData, userId: string): Promise<PlanWithSteps> {
    const planId = nanoid();
    const now = new Date();

    const planData: NewPlan = {
      id: planId,
      userId,
      sessionId: data.sessionId,
      agentId: data.agentId,
      title: data.title,
      description: data.description,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(plans).values(planData);

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
      await db.insert(planSteps).values(stepData);
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

  async update(id: string, data: UpdatePlanData, userId: string): Promise<PlanWithSteps | null> {
    const now = new Date();

    const updateData: Partial<PlanRecord> = {
      ...data,
      updatedAt: now,
    };

    if (data.status === "completed" || data.status === "failed") {
      updateData.completedAt = now;
    }

    await db.update(plans).set(updateData).where(and(eq(plans.id, id), eq(plans.userId, userId)));

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      return false;
    }

    await db.delete(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
    return true;
  }

  // ---------------------------------------------------------------------------
  // Step Operations
  // ---------------------------------------------------------------------------

  async findStepById(stepId: string): Promise<PlanStepRecord | null> {
    const [step] = await db.select().from(planSteps).where(eq(planSteps.id, stepId));
    return step ?? null;
  }

  async addSteps(planId: string, steps: AddStepData[]): Promise<PlanStepRecord[]> {
    const now = new Date();

    const existingSteps = await db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence));

    let insertAt = existingSteps.length;

    if (steps.length > 0 && steps[0].afterStepId) {
      const afterIdx = existingSteps.findIndex((s: { id: string }) => s.id === steps[0].afterStepId);
      if (afterIdx !== -1) {
        insertAt = afterIdx + 1;
        for (let i = insertAt; i < existingSteps.length; i++) {
          await db.update(planSteps)
            .set({ sequence: existingSteps[i].sequence + steps.length })
            .where(eq(planSteps.id, existingSteps[i].id));
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
      await db.insert(planSteps).values(stepData);
      newSteps.push({
        ...stepData,
        assignedAgentId: null,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      } as PlanStepRecord);
    }

    await db.update(plans).set({ updatedAt: now }).where(eq(plans.id, planId));

    return newSteps;
  }

  async updateStep(stepId: string, data: UpdateStepData): Promise<PlanStepRecord | null> {
    const now = new Date();

    const updateData: Partial<PlanStepRecord> = { ...data };

    if (data.status === "in_progress" && !updateData.startedAt) {
      updateData.startedAt = now;
    }

    if (data.status === "completed" || data.status === "failed" || data.status === "skipped") {
      updateData.completedAt = now;
    }

    await db.update(planSteps).set(updateData).where(eq(planSteps.id, stepId));

    const step = await this.findStepById(stepId);
    if (step) {
      await db.update(plans).set({ updatedAt: now }).where(eq(plans.id, step.planId));
    }

    return step;
  }

  async removeSteps(stepIds: string[]): Promise<void> {
    const now = new Date();

    const firstStep = stepIds.length > 0 ? await this.findStepById(stepIds[0]) : null;
    const planId = firstStep?.planId;

    for (const stepId of stepIds) {
      await db.delete(planSteps).where(eq(planSteps.id, stepId));
    }

    if (planId) {
      await this.resequenceSteps(planId);
      await db.update(plans).set({ updatedAt: now }).where(eq(plans.id, planId));
    }
  }

  async resequenceSteps(planId: string): Promise<void> {
    const steps = await db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence));

    for (let i = 0; i < steps.length; i++) {
      if (steps[i].sequence !== i + 1) {
        await db.update(planSteps)
          .set({ sequence: i + 1 })
          .where(eq(planSteps.id, steps[i].id));
      }
    }
  }

  async getSteps(planId: string): Promise<PlanStepRecord[]> {
    return db
      .select()
      .from(planSteps)
      .where(eq(planSteps.planId, planId))
      .orderBy(asc(planSteps.sequence));
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
