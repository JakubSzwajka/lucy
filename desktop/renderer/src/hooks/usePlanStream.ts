import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import type { Plan, PlanStep } from "@/components/plan";
import type { PlanStatus, PlanStepStatus } from "@/types/plan";

/**
 * Extract the latest plan state from streaming messages.
 * Scans rawMessages in reverse to find the most recent create_plan or update_plan
 * tool result with available output.
 */
export function extractPlanFromMessages(messages: UIMessage[]): Plan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      if (!isToolUIPart(part)) continue;
      if (part.state !== "output-available") continue;

      const output = part.output as Record<string, unknown> | undefined;
      if (!output || output.success !== true) continue;

      const toolName = getToolName(part);

      if (toolName === "create_plan") {
        return mapCreatePlanResult(output);
      }

      if (toolName === "update_plan") {
        return mapUpdatePlanResult(output);
      }
    }
  }

  return null;
}

function mapCreatePlanResult(output: Record<string, unknown>): Plan {
  const steps = (output.steps as Array<{ id: string; description: string; status: string }>) || [];
  const stepCount = steps.length;

  return {
    id: output.planId as string,
    title: output.title as string,
    status: "pending" as PlanStatus,
    steps: steps.map((s, idx): PlanStep => ({
      id: s.id,
      sequence: idx + 1,
      description: s.description,
      status: (s.status || "pending") as PlanStepStatus,
    })),
    progress: {
      completed: 0,
      total: stepCount,
      percentage: 0,
    },
  };
}

function mapUpdatePlanResult(output: Record<string, unknown>): Plan {
  const steps = (output.steps as Array<{
    id: string;
    sequence: number;
    description: string;
    status: string;
    result?: string | null;
    error?: string | null;
  }>) || [];

  const progress = parseProgress(output.progress as string | null, steps);

  return {
    id: output.planId as string,
    title: output.title as string,
    status: output.status as PlanStatus,
    steps: steps.map((s): PlanStep => ({
      id: s.id,
      sequence: s.sequence,
      description: s.description,
      status: s.status as PlanStepStatus,
      result: s.result,
      error: s.error,
    })),
    progress,
  };
}

function parseProgress(
  progressStr: string | null,
  steps: Array<{ status: string }>
): Plan["progress"] {
  if (progressStr) {
    const match = progressStr.match(/^(\d+)\/(\d+)\s+steps\s+\((\d+)%\)$/);
    if (match) {
      return {
        completed: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
        percentage: parseInt(match[3], 10),
      };
    }
  }

  // Fallback: compute from steps
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "completed").length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
