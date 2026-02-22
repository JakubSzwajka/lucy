/**
 * Plan Tool Module
 *
 * Tools for creating and managing execution plans.
 * Plans help agents break down complex tasks into trackable steps.
 */

import { z } from "zod";
import { defineToolModule, defineTool } from "../../types";
import type { PlanService } from "@/lib/server/services/plan";

/**
 * Plan module definition.
 */
export const planModule = defineToolModule<PlanService>({
  id: "plan",
  name: "Planning",
  description: "Create and manage execution plans for complex tasks",
  integrationId: "plan",

  createTools: (planService) => [
    defineTool({
      name: "create_plan",
      description: `Create an execution plan for a complex task. Use this when a task requires multiple steps that should be tracked systematically.

IMPORTANT: Each session can only have ONE plan. If a plan already exists, use update_plan to modify it.

When to create a plan:
- Multi-step tasks that benefit from tracking
- Complex work that needs to be broken into phases
- Tasks where you want to show progress to the user`,

      inputSchema: z.object({
        title: z.string().describe("Short, descriptive title for the plan"),
        description: z
          .string()
          .optional()
          .describe("Optional context or goal description"),
        steps: z
          .array(
            z.object({
              description: z
                .string()
                .describe("What this step accomplishes"),
            })
          )
          .min(1)
          .describe("Ordered list of steps to execute"),
      }),

      source: { type: "builtin", moduleId: "plan" },

      execute: async (args, context) => {
        const result = await planService.create({
          sessionId: context.sessionId,
          agentId: context.agentId,
          title: args.title,
          description: args.description,
          steps: args.steps,
        }, context.userId);

        if (result.error) {
          return { success: false, error: result.error };
        }

        return {
          success: true,
          planId: result.plan!.id,
          title: result.plan!.title,
          stepCount: result.plan!.steps.length,
          steps: result.plan!.steps.map((s) => ({
            id: s.id,
            description: s.description,
            status: s.status,
          })),
        };
      },
    }),

    defineTool({
      name: "update_plan",
      description: `Update an existing plan. Can modify metadata, add/update/remove steps, and change step statuses.

Use this to:
- Mark steps as completed, in_progress, or failed
- Add new steps to the plan
- Remove steps (including completed ones)
- Update the plan title or description
- Explicitly set plan status

The plan status is automatically derived from step statuses unless explicitly set.`,

      inputSchema: z.object({
        planId: z.string().describe("ID of the plan to update"),

        // Plan-level updates
        title: z.string().optional().describe("New title for the plan"),
        description: z
          .string()
          .optional()
          .describe("New description for the plan"),
        status: z
          .enum(["in_progress", "completed", "failed", "cancelled"])
          .optional()
          .describe("Explicitly set plan status (usually auto-derived)"),

        // Step operations
        addSteps: z
          .array(
            z.object({
              description: z.string().describe("Step description"),
              afterStepId: z
                .string()
                .optional()
                .describe("Insert after this step ID (appends to end if omitted)"),
            })
          )
          .optional()
          .describe("Add new steps to the plan"),

        updateSteps: z
          .array(
            z.object({
              stepId: z.string().describe("ID of the step to update"),
              description: z.string().optional().describe("New description"),
              status: z
                .enum(["pending", "in_progress", "completed", "failed", "skipped"])
                .optional()
                .describe("New status for the step"),
              result: z
                .string()
                .optional()
                .describe("Outcome summary (for completed steps)"),
              error: z
                .string()
                .optional()
                .describe("Error message (for failed steps)"),
            })
          )
          .optional()
          .describe("Update existing steps"),

        removeSteps: z
          .array(z.string())
          .optional()
          .describe("Step IDs to remove from the plan"),
      }),

      source: { type: "builtin", moduleId: "plan" },

      execute: async (args, context) => {
        const { planId, ...updates } = args;

        const result = await planService.update(planId, updates, context.userId);

        if (result.notFound) {
          return { success: false, error: "Plan not found" };
        }

        if (result.error) {
          return { success: false, error: result.error };
        }

        const progress = await planService.getProgress(planId, context.userId);

        return {
          success: true,
          planId,
          title: result.plan!.title,
          status: result.plan!.status,
          progress: progress
            ? `${progress.completed}/${progress.total} steps (${progress.percentage}%)`
            : null,
          steps: result.plan!.steps.map((s) => ({
            id: s.id,
            sequence: s.sequence,
            description: s.description,
            status: s.status,
            result: s.result,
            error: s.error,
          })),
        };
      },
    }),

    defineTool({
      name: "get_plan",
      description: `Get the current plan for this session. Returns the plan with all steps and their statuses.`,

      inputSchema: z.object({}),

      source: { type: "builtin", moduleId: "plan" },

      execute: async (_args, context) => {
        const plan = await planService.getBySessionId(context.sessionId, context.userId);

        if (!plan) {
          return { hasPlan: false, message: "No plan exists for this session" };
        }

        const progress = await planService.getProgress(plan.id, context.userId);

        return {
          hasPlan: true,
          planId: plan.id,
          title: plan.title,
          description: plan.description,
          status: plan.status,
          progress: progress
            ? `${progress.completed}/${progress.total} steps (${progress.percentage}%)`
            : null,
          steps: plan.steps.map((s) => ({
            id: s.id,
            sequence: s.sequence,
            description: s.description,
            status: s.status,
            result: s.result,
            error: s.error,
          })),
        };
      },
    }),
  ],
});
