"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircle2Icon,
  CircleIcon,
  CircleDotIcon,
  XCircleIcon,
  MinusCircleIcon,
  ListTodoIcon,
} from "lucide-react";
import type { PlanStepStatus, PlanStatus } from "@/types/plan";

// ============================================================================
// Types
// ============================================================================

export interface PlanStep {
  id: string;
  sequence: number;
  description: string;
  status: PlanStepStatus;
  result?: string | null;
  error?: string | null;
}

export interface Plan {
  id: string;
  title: string;
  description?: string | null;
  status: PlanStatus;
  steps: PlanStep[];
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  } | null;
}

interface PlanPanelProps {
  plan: Plan;
  className?: string;
}

// ============================================================================
// Status Helpers
// ============================================================================

function getStepIcon(status: PlanStepStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2Icon className="size-4 text-green-500" />;
    case "in_progress":
      return <CircleDotIcon className="size-4 text-blue-500 animate-pulse" />;
    case "failed":
      return <XCircleIcon className="size-4 text-red-500" />;
    case "skipped":
      return <MinusCircleIcon className="size-4 text-muted-foreground" />;
    case "pending":
    default:
      return <CircleIcon className="size-4 text-muted-foreground" />;
  }
}

function getPlanStatusBadge(status: PlanStatus) {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">Completed</Badge>;
    case "in_progress":
      return <Badge variant="default" className="bg-blue-500/20 text-blue-500 border-blue-500/30">In Progress</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    case "pending":
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

// ============================================================================
// Step Component
// ============================================================================

function PlanStepItem({ step }: { step: PlanStep }) {
  const isActive = step.status === "in_progress";
  const isDone = step.status === "completed" || step.status === "skipped";

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2 px-3 rounded-md transition-colors",
        isActive && "bg-blue-500/10",
        isDone && "opacity-60"
      )}
    >
      <div className="mt-0.5 shrink-0">{getStepIcon(step.status)}</div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm",
            isDone && "line-through text-muted-foreground"
          )}
        >
          {step.description}
        </p>
        {step.result && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {step.result}
          </p>
        )}
        {step.error && (
          <p className="text-xs text-red-500 mt-1 truncate">{step.error}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlanPanel({ plan, className }: PlanPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  const progress = plan.progress;
  const progressValue = progress?.percentage ?? 0;
  const completedCount = progress?.completed ?? 0;
  const totalCount = progress?.total ?? plan.steps.length;

  // Find current step (first in_progress or first pending)
  const currentStep =
    plan.steps.find((s) => s.status === "in_progress") ||
    plan.steps.find((s) => s.status === "pending");

  return (
    <div
      className={cn(
        "border-t border-border bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header - always visible */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-3 h-auto rounded-none hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <ListTodoIcon className="size-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{plan.title}</span>
                {getPlanStatusBadge(plan.status)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} steps
              </span>
              {isOpen ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronUpIcon className="size-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        {/* Collapsed preview - show current step */}
        {!isOpen && currentStep && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {getStepIcon(currentStep.status)}
              <span className="truncate">{currentStep.description}</span>
            </div>
            <Progress value={progressValue} className="mt-2 h-1" />
          </div>
        )}

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {/* Progress bar */}
            <div className="mb-3">
              <Progress value={progressValue} className="h-1.5" />
            </div>

            {/* Description */}
            {plan.description && (
              <p className="text-xs text-muted-foreground mb-3">
                {plan.description}
              </p>
            )}

            {/* Steps list */}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {plan.steps.map((step) => (
                <PlanStepItem key={step.id} step={step} />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
