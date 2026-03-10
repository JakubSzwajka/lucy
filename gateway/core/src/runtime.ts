import { AgentRuntime, type LucyConfig } from "agents-runtime";

let runtime: AgentRuntime | null = null;

export async function initRuntime(config: LucyConfig): Promise<AgentRuntime> {
  if (runtime) return runtime;

  runtime = new AgentRuntime({ config: config.runtime });
  await runtime.init();

  return runtime;
}

export function getRuntime(): AgentRuntime {
  if (!runtime) {
    throw new Error("Runtime not initialized. Call initRuntime() first.");
  }
  return runtime;
}

export async function destroyRuntime(): Promise<void> {
  if (!runtime) return;
  await runtime.destroy();
  runtime = null;
}
