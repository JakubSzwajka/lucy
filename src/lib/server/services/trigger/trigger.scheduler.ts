import { PgBoss } from "pg-boss";
import { getTriggerRepository } from "./trigger.repository";
import { getTriggerService } from "./trigger.service";
import type { Trigger } from "@/types";

export class TriggerScheduler {
  private boss: PgBoss | null = null;

  async start(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn("[TriggerScheduler] No DATABASE_URL, skipping scheduler start");
      return;
    }

    this.boss = new PgBoss(databaseUrl);
    await this.boss.start();
    console.log("[TriggerScheduler] pg-boss started");

    // Load and schedule all enabled cron triggers
    const repo = getTriggerRepository();
    const cronTriggers = await repo.findAllEnabledCron();
    console.log(`[TriggerScheduler] Found ${cronTriggers.length} enabled cron triggers`);

    for (const trigger of cronTriggers) {
      await this.scheduleTrigger(trigger);
    }
  }

  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop();
      this.boss = null;
      console.log("[TriggerScheduler] pg-boss stopped");
    }
  }

  async scheduleTrigger(trigger: Trigger): Promise<void> {
    if (!this.boss) return;
    if (trigger.triggerType !== "cron" || !trigger.cronExpression || !trigger.enabled) return;

    const jobName = `trigger:${trigger.id}`;

    // Schedule the cron job
    await this.boss.schedule(jobName, trigger.cronExpression, { triggerId: trigger.id }, {
      tz: trigger.timezone || "UTC",
    });

    // Register the worker — pg-boss delivers jobs as an array
    await this.boss.work<{ triggerId: string }>(jobName, async (jobs) => {
      for (const job of jobs) {
        console.log(`[TriggerScheduler] Executing trigger ${job.data.triggerId}`);
        try {
          await getTriggerService().execute(job.data.triggerId);
        } catch (error) {
          console.error(`[TriggerScheduler] Trigger ${job.data.triggerId} failed:`, error);
        }
      }
    });

    console.log(`[TriggerScheduler] Scheduled trigger "${trigger.name}" (${trigger.cronExpression})`);
  }

  async unscheduleTrigger(triggerId: string): Promise<void> {
    if (!this.boss) return;
    const jobName = `trigger:${triggerId}`;
    await this.boss.unschedule(jobName);
    // Note: pg-boss doesn't have a way to unregister a worker, but unscheduling
    // stops new jobs from being created. The worker will just never fire.
    console.log(`[TriggerScheduler] Unscheduled trigger ${triggerId}`);
  }

  async syncTrigger(trigger: Trigger): Promise<void> {
    await this.unscheduleTrigger(trigger.id);
    if (trigger.triggerType === "cron" && trigger.enabled && trigger.cronExpression) {
      await this.scheduleTrigger(trigger);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TriggerScheduler | null = null;

export function getTriggerScheduler(): TriggerScheduler {
  if (!instance) {
    instance = new TriggerScheduler();
  }
  return instance;
}
