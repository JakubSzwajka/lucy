import { db } from "@/lib/db";
import { triggers, triggerRuns } from "@/lib/db/schema";
import type { TriggerRecord, TriggerRunRecord } from "@/lib/db/schema";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  Trigger,
  TriggerRun,
  TriggerWithRuns,
  TriggerCreate,
  TriggerUpdate,
  TriggerRunStatus,
} from "@/types";

// ============================================================================
// Helpers
// ============================================================================

function parseTriggerRecord(record: TriggerRecord): Trigger {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    agentConfigId: record.agentConfigId,
    triggerType: record.triggerType,
    cronExpression: record.cronExpression,
    timezone: record.timezone,
    inputTemplate: record.inputTemplate,
    enabled: record.enabled,
    maxTurns: record.maxTurns,
    maxRunsPerHour: record.maxRunsPerHour,
    cooldownSeconds: record.cooldownSeconds,
    lastTriggeredAt: record.lastTriggeredAt,
    lastRunSessionId: record.lastRunSessionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseRunRecord(record: TriggerRunRecord): TriggerRun {
  return {
    id: record.id,
    triggerId: record.triggerId,
    sessionId: record.sessionId,
    status: record.status,
    skipReason: record.skipReason,
    result: record.result,
    error: record.error,
    eventPayload: record.eventPayload,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  };
}

// ============================================================================
// Trigger Repository
// ============================================================================

export class TriggerRepository {
  async findById(id: string, userId: string): Promise<TriggerWithRuns | null> {
    const [record] = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.id, id), eq(triggers.userId, userId)));

    if (!record) return null;

    const runRecords = await db
      .select()
      .from(triggerRuns)
      .where(eq(triggerRuns.triggerId, id))
      .orderBy(desc(triggerRuns.startedAt))
      .limit(10);

    return {
      ...parseTriggerRecord(record),
      recentRuns: runRecords.map(parseRunRecord),
    };
  }

  async findByIdInternal(id: string): Promise<Trigger | null> {
    const [record] = await db
      .select()
      .from(triggers)
      .where(eq(triggers.id, id));

    return record ? parseTriggerRecord(record) : null;
  }

  async findAll(userId: string): Promise<Trigger[]> {
    const records = await db
      .select()
      .from(triggers)
      .where(eq(triggers.userId, userId))
      .orderBy(desc(triggers.updatedAt));

    return records.map(parseTriggerRecord);
  }

  async findAllEnabledCron(): Promise<Trigger[]> {
    const records = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.enabled, true), eq(triggers.triggerType, "cron")));

    return records.map(parseTriggerRecord);
  }

  async create(data: TriggerCreate, userId: string): Promise<Trigger> {
    const id = nanoid();

    await db.insert(triggers).values({
      id,
      userId,
      name: data.name,
      description: data.description ?? null,
      agentConfigId: data.agentConfigId,
      triggerType: data.triggerType,
      cronExpression: data.cronExpression ?? null,
      timezone: data.timezone ?? "UTC",
      inputTemplate: data.inputTemplate,
      enabled: data.enabled ?? true,
      maxTurns: data.maxTurns ?? 25,
      maxRunsPerHour: data.maxRunsPerHour ?? 10,
      cooldownSeconds: data.cooldownSeconds ?? 0,
    });

    const [record] = await db
      .select()
      .from(triggers)
      .where(eq(triggers.id, id));

    return parseTriggerRecord(record);
  }

  async update(id: string, data: TriggerUpdate, userId: string): Promise<Trigger | null> {
    const [existing] = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.id, id), eq(triggers.userId, userId)));

    if (!existing) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.agentConfigId !== undefined) updateData.agentConfigId = data.agentConfigId;
    if (data.cronExpression !== undefined) updateData.cronExpression = data.cronExpression;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.inputTemplate !== undefined) updateData.inputTemplate = data.inputTemplate;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.maxTurns !== undefined) updateData.maxTurns = data.maxTurns;
    if (data.maxRunsPerHour !== undefined) updateData.maxRunsPerHour = data.maxRunsPerHour;
    if (data.cooldownSeconds !== undefined) updateData.cooldownSeconds = data.cooldownSeconds;

    await db
      .update(triggers)
      .set(updateData)
      .where(and(eq(triggers.id, id), eq(triggers.userId, userId)));

    const [record] = await db
      .select()
      .from(triggers)
      .where(eq(triggers.id, id));

    return parseTriggerRecord(record);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(triggers)
      .where(and(eq(triggers.id, id), eq(triggers.userId, userId)));

    if (!existing) return false;

    await db.delete(triggers).where(and(eq(triggers.id, id), eq(triggers.userId, userId)));
    return true;
  }

  async updateLastTriggered(id: string, sessionId: string): Promise<void> {
    await db
      .update(triggers)
      .set({
        lastTriggeredAt: new Date(),
        lastRunSessionId: sessionId,
      })
      .where(eq(triggers.id, id));
  }

  async countRecentRuns(triggerId: string, withinSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - withinSeconds * 1000);

    const [result] = await db
      .select({ value: count() })
      .from(triggerRuns)
      .where(
        and(
          eq(triggerRuns.triggerId, triggerId),
          gte(triggerRuns.startedAt, cutoff)
        )
      );

    return result?.value ?? 0;
  }

  async createRun(triggerId: string, eventPayload?: Record<string, unknown>): Promise<TriggerRun> {
    const id = nanoid();

    await db.insert(triggerRuns).values({
      id,
      triggerId,
      status: "pending",
      eventPayload: eventPayload ?? null,
    });

    const [record] = await db
      .select()
      .from(triggerRuns)
      .where(eq(triggerRuns.id, id));

    return parseRunRecord(record);
  }

  async updateRun(
    runId: string,
    data: {
      status: TriggerRunStatus;
      result?: string;
      error?: string;
      skipReason?: string;
      sessionId?: string;
      completedAt?: Date;
    }
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status: data.status,
    };

    if (data.result !== undefined) updateData.result = data.result;
    if (data.error !== undefined) updateData.error = data.error;
    if (data.skipReason !== undefined) updateData.skipReason = data.skipReason;
    if (data.sessionId !== undefined) updateData.sessionId = data.sessionId;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    await db
      .update(triggerRuns)
      .set(updateData)
      .where(eq(triggerRuns.id, runId));
  }

  async findRuns(
    triggerId: string,
    limit: number,
    offset: number
  ): Promise<{ runs: TriggerRun[]; total: number }> {
    const [totalResult] = await db
      .select({ value: count() })
      .from(triggerRuns)
      .where(eq(triggerRuns.triggerId, triggerId));

    const total = totalResult?.value ?? 0;

    const records = await db
      .select()
      .from(triggerRuns)
      .where(eq(triggerRuns.triggerId, triggerId))
      .orderBy(desc(triggerRuns.startedAt))
      .limit(limit)
      .offset(offset);

    return {
      runs: records.map(parseRunRecord),
      total,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TriggerRepository | null = null;

export function getTriggerRepository(): TriggerRepository {
  if (!instance) {
    instance = new TriggerRepository();
  }
  return instance;
}
