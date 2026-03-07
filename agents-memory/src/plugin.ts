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
    sessionId: input.sessionId,
    status: input.run.status,
    userId: input.userId,
  };
}

export function createMemoryPlugin(options: MemoryPluginOptions = {}): MemoryPlugin {
  const context: MemoryPluginContext = {};

  return {
    id: options.id ?? DEFAULT_PLUGIN_ID,
    onInit: async () => {
      console.log("🧠 Memory plugin initialized");
    },
    onDestroy: async () => {
      console.log("🧠 Memory plugin destroyed");
    },
    async onRunComplete(input) {
      rememberObservedRun(context, input);

      try {
        await input.pluginConfig.onRunObserved?.(input, context);
      } catch {
        // Runtime hook failures currently abort execution globally. Keep the
        // scaffolded observer best-effort so memory stays additive-only.
      }
    },
    async prepareContext(input) {
      const memory = await resolveMemoryContext(input.pluginConfig, input);
      context.memory = memory;

      if (!memory) {
        return;
      }

      return {
        systemPromptSections: [toSystemPromptSection(memory)],
      };
    },
  };
}
