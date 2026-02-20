/**
 * Plan Integration
 *
 * Provides planning capabilities for agents.
 * Always available - uses internal database.
 */

import { getPlanService, type PlanService } from "@/lib/services/plan";

/**
 * Plan integration definition.
 */
export const planIntegration = {
  id: "plan",
  name: "Planning",
  description: "Create and manage execution plans for complex tasks",

  /**
   * Plan is always configured (uses internal database).
   */
  isConfigured: () => true,

  /**
   * Return the PlanService as the client.
   */
  createClient: (): PlanService => {
    return getPlanService();
  },
};
