import type { ToolModule } from "../types";
import { continuityModule } from "./continuity";
import { planModule } from "./plan";

export { continuityModule } from "./continuity";
export { planModule } from "./plan";
export { generateDelegateTools } from "./delegate";

export const allToolModules: ToolModule[] = [
  continuityModule,
  planModule,
];

export function getToolModule(id: string): ToolModule | undefined {
  return allToolModules.find((m) => m.id === id);
}
