import { TriggerRepository, getTriggerRepository } from "./trigger.repository";
import { getSessionService } from "@/lib/server/domain/session";
import { getItemService } from "@/lib/server/domain/item";
import { getChatService, cancelAgent } from "@/lib/server/chat";
import type { TriggerCreate, TriggerUpdate, Trigger, TriggerWithRuns } from "@/types";

// ============================================================================
// Trigger Service
// ============================================================================

export class TriggerService {
  private repository: TriggerRepository;

  constructor(repository?: TriggerRepository) {
    this.repository = repository || getTriggerRepository();
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  async getAll(userId: string): Promise<Trigger[]> {
    return this.repository.findAll(userId);
  }

  async getById(id: string, userId: string): Promise<TriggerWithRuns | null> {
    return this.repository.findById(id, userId);
  }

  async create(
    data: TriggerCreate,
    userId: string
  ): Promise<{ trigger?: Trigger; error?: string }> {
    if (data.triggerType === "cron" && !data.cronExpression) {
      return { error: "cronExpression is required for cron triggers" };
    }

    const trigger = await this.repository.create(data, userId);
    return { trigger };
  }

  async update(
    id: string,
    data: TriggerUpdate,
    userId: string
  ): Promise<{ trigger?: Trigger; error?: string; notFound?: boolean }> {
    const trigger = await this.repository.update(id, data, userId);
    if (!trigger) return { notFound: true };
    return { trigger };
  }

  async delete(id: string, userId: string): Promise<{ success: boolean; notFound?: boolean }> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) return { success: false, notFound: true };
    return { success: true };
  }

  async getRuns(
    triggerId: string,
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ runs: import("@/types").TriggerRun[]; total: number } | null> {
    const trigger = await this.repository.findById(triggerId, userId);
    if (!trigger) return null;

    return this.repository.findRuns(triggerId, limit, offset);
  }

  // -------------------------------------------------------------------------
  // Cancel a running trigger run
  // -------------------------------------------------------------------------

  async cancelRun(
    runId: string,
    triggerId: string,
    userId: string
  ): Promise<{ success: boolean; notFound?: boolean; error?: string }> {
    // Verify ownership
    const trigger = await this.repository.findById(triggerId, userId);
    if (!trigger) return { success: false, notFound: true };

    // Find the run's session to get the agent
    const runsResult = await this.repository.findRuns(triggerId, 100, 0);
    const run = runsResult.runs.find((r) => r.id === runId);
    if (!run) return { success: false, notFound: true };

    if (run.status !== "running" && run.status !== "pending") {
      return { success: false, error: "Run is not active" };
    }

    // If there's a session, find its root agent and cancel it
    if (run.sessionId) {
      const sessionService = getSessionService();
      const session = await sessionService.getById(run.sessionId, userId);
      if (session?.rootAgentId) {
        cancelAgent(session.rootAgentId);
      }
    }

    // Mark the run as failed/cancelled
    await this.repository.updateRun(runId, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: new Date(),
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Core Execution
  // -------------------------------------------------------------------------

  /**
   * Execute a trigger: validate guards (enabled, rate limit, cooldown),
   * create a session, send the input message, and run the agent.
   */
  async execute(
    triggerId: string,
    eventPayload?: Record<string, unknown>
  ): Promise<{ runId: string; sessionId?: string }> {
    const trigger = await this.repository.findByIdInternal(triggerId);
    if (!trigger) throw new Error("Trigger not found");

    // Guard: disabled
    if (!trigger.enabled) {
      const run = await this.repository.createRun(triggerId, eventPayload);
      await this.repository.updateRun(run.id, {
        status: "skipped",
        skipReason: "Trigger is disabled",
        completedAt: new Date(),
      });
      return { runId: run.id };
    }

    // Guard: rate limit
    const recentCount = await this.repository.countRecentRuns(triggerId, 3600);
    if (recentCount >= trigger.maxRunsPerHour) {
      const run = await this.repository.createRun(triggerId, eventPayload);
      await this.repository.updateRun(run.id, {
        status: "skipped",
        skipReason: `Rate limit exceeded (${trigger.maxRunsPerHour}/hour)`,
        completedAt: new Date(),
      });
      return { runId: run.id };
    }

    // Guard: cooldown
    if (trigger.cooldownSeconds > 0 && trigger.lastTriggeredAt) {
      const elapsed = (Date.now() - trigger.lastTriggeredAt.getTime()) / 1000;
      if (elapsed < trigger.cooldownSeconds) {
        const run = await this.repository.createRun(triggerId, eventPayload);
        await this.repository.updateRun(run.id, {
          status: "skipped",
          skipReason: `Cooldown active (${Math.ceil(trigger.cooldownSeconds - elapsed)}s remaining)`,
          completedAt: new Date(),
        });
        return { runId: run.id };
      }
    }

    // Create run record
    const run = await this.repository.createRun(triggerId, eventPayload);

    try {
      await this.repository.updateRun(run.id, { status: "running" });

      // Interpolate input template with event payload
      let input = trigger.inputTemplate;
      if (eventPayload) {
        input = input.replace(
          /\{\{payload\.(\w+(?:\.\w+)*)\}\}/g,
          (_, path: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = path.split(".").reduce((obj: any, key: string) => obj?.[key], eventPayload);
            return value !== undefined ? String(value) : "";
          }
        );
      }

      // Create session with the trigger's agent config
      const sessionResult = await getSessionService().create(trigger.userId, {
        agentConfigId: trigger.agentConfigId,
      });
      if (!sessionResult.session) {
        throw new Error(sessionResult.error || "Failed to create session");
      }
      const session = sessionResult.session;
      const rootAgentId = session.rootAgentId;
      if (!rootAgentId) throw new Error("Session has no root agent");

      // Set session title to trigger name for traceability
      await getSessionService().update(session.id, { title: `[Trigger] ${trigger.name}` }, trigger.userId);

      // Persist the user message
      await getItemService().createMessage(rootAgentId, "user", input, trigger.userId);

      // Build initial model messages from persisted items
      const allItems = await getItemService().getByAgentId(rootAgentId);
      const modelMessages = allItems
        .filter((i): i is import("@/types").MessageItem => i.type === "message" && i.role !== "system")
        .map((i) => ({
          role: i.role as "user" | "assistant",
          content: i.content || "",
        }));

      // Run agent (non-streaming, with thinking enabled)
      await getChatService().runAgent(rootAgentId, trigger.userId, modelMessages, {
        sessionId: session.id,
        streaming: false,
        maxTurns: trigger.maxTurns,
        thinkingEnabled: true,
      });

      // Extract result from last assistant message
      const finalItems = await getItemService().getByAgentId(rootAgentId);
      const lastAssistant = [...finalItems]
        .reverse()
        .find((i): i is import("@/types").MessageItem => i.type === "message" && i.role === "assistant");
      const resultText = lastAssistant?.content || "Completed";

      await this.repository.updateRun(run.id, {
        status: "completed",
        result: resultText,
        sessionId: session.id,
        completedAt: new Date(),
      });
      await this.repository.updateLastTriggered(triggerId, session.id);

      return { runId: run.id, sessionId: session.id };
    } catch (error) {
      await this.repository.updateRun(run.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      });
      return { runId: run.id };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TriggerService | null = null;

export function getTriggerService(): TriggerService {
  if (!instance) {
    instance = new TriggerService();
  }
  return instance;
}
