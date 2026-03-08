import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { RuntimeDeps } from "agents-runtime";

import { observe } from "./observe.js";
import { synthesizeMemory } from "./synthesize.js";
import type {
  MemoryContextRecord,
  MemoryPlugin,
  MemoryPluginConfig,
  MemoryPluginContext,
  MemoryPluginOptions,
  MemoryPluginPrepareContextInput,
  MemoryPluginRunCompleteInput,
  MemoryPluginSystemPromptSectionShape,
} from "./types.js";
import { MEMORY_MD_PATH } from "./types.js";

const DEFAULT_PLUGIN_ID = "memory";
const DEFAULT_SECTION_KEY = "memory";
const DEFAULT_SECTION_TITLE = "Memory";

function toSystemPromptSection(
  memory: MemoryContextRecord,
): MemoryPluginSystemPromptSectionShape {
  return {
    content: memory.content,
    key: DEFAULT_SECTION_KEY,
    title: memory.title ?? DEFAULT_SECTION_TITLE,
  };
}

async function resolveMemoryContext(
  config: MemoryPluginConfig,
  input: MemoryPluginPrepareContextInput,
): Promise<MemoryContextRecord | null> {
  const memory = await config.getContext?.(input);

  if (memory) {
    return memory;
  }

  return config.initialMemory ?? null;
}

function rememberObservedRun(
  context: MemoryPluginContext,
  input: MemoryPluginRunCompleteInput,
): void {
  context.latestRun = {
    agentId: input.agent.id,
    output: input.run.output,
    status: input.run.status,
    userId: input.userId,
  };
}

async function readMemoryFromDisk(
  dataDir: string,
): Promise<MemoryContextRecord | null> {
  try {
    const filePath = join(dataDir, MEMORY_MD_PATH);
    const content = await readFile(filePath, "utf-8");
    const trimmed = content.trim();

    if (!trimmed) {
      return null;
    }

    return { content: trimmed, title: DEFAULT_SECTION_TITLE };
  } catch {
    return null;
  }
}

async function runObserverPipeline(
  deps: RuntimeDeps,
  dataDir: string,
  agentId: string,
  config: { modelId: string; maxFacts?: number },
): Promise<void> {
  const modelConfig = await deps.models.getModelConfig(config.modelId);
  if (!modelConfig) {
    console.warn(`[memory] observer: model not found: ${config.modelId}`);
    return;
  }

  const model = deps.models.getLanguageModel(modelConfig);

  // Step 1: Extract observations from new conversation items
  await observe(dataDir, agentId, model);

  // Step 2: Synthesize memory.md from all observations
  await synthesizeMemory(dataDir, model, config.maxFacts);
}

export function createMemoryPlugin(options: MemoryPluginOptions = {}): MemoryPlugin {
  const context: MemoryPluginContext = {};
  const dataDir = options.dataDir;
  const observerConfig = options.observer;
  let runtimeDeps: RuntimeDeps | null = null;

  return {
    id: options.id ?? DEFAULT_PLUGIN_ID,
    onInit: async (input) => {
      runtimeDeps = input.deps;
      console.log("[memory] initialized");
    },
    onDestroy: async () => {
      console.log("[memory] destroyed");
    },
    async onRunComplete(input) {
      console.log("[memory] onRunComplete", input);
      rememberObservedRun(context, input);

      try {
        await input.pluginConfig.onRunObserved?.(input, context);
      } catch (err) {
        console.error("[memory] onRunObserved failed", err);
        // Runtime hook failures currently abort execution globally. Keep the
        // scaffolded observer best-effort so memory stays additive-only.
      }

      // Run memory observation pipeline if configured
      if (dataDir && observerConfig && runtimeDeps) {
        // Fire-and-forget — don't block the runtime
        console.log("[memory] running observer pipeline");
        runObserverPipeline(runtimeDeps, dataDir, input.agent.id, observerConfig).catch((err) => {
          console.error("[memory] observer failed:", err);
        });
        console.log("[memory] observer pipeline completed");
      }
    },
    async prepareContext(input) {
      console.log("[memory] prepareContext", input);
      let memory: MemoryContextRecord | null = null;

      if (dataDir) {
        memory = await readMemoryFromDisk(dataDir);
      }

      console.log("[memory] memory", memory);

      if (!memory) {
        console.log("[memory] resolving memory context");
        memory = await resolveMemoryContext(input.pluginConfig, input);
      }

      console.log("[memory] memory context resolved", memory);

      context.memory = memory;

      if (!memory) {
        console.log("[memory] no memory found");
        return;
      }

      console.log("[memory] returning system prompt sections", [toSystemPromptSection(memory)]);

      return {
        systemPromptSections: [toSystemPromptSection(memory)],
      };
    },
  };
}
