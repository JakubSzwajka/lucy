import type {
  Agent,
  ChatContext,
  ResolvedRuntimePlugin,
  RuntimeDeps,
  RuntimePluginRunSummary,
  RuntimePluginSystemPromptSection,
} from "../types.js";

export async function initPlugins(
  resolvedPlugins: ResolvedRuntimePlugin[],
  deps: RuntimeDeps,
): Promise<void> {
  for (const resolvedPlugin of resolvedPlugins) {
    await resolvedPlugin.plugin.onInit?.({
      deps,
      pluginConfig: resolvedPlugin.config,
    });
  }
}

export async function destroyPlugins(
  resolvedPlugins: ResolvedRuntimePlugin[],
): Promise<void> {
  for (const resolvedPlugin of resolvedPlugins) {
    await resolvedPlugin.plugin.onDestroy?.();
  }
}

export async function preparePluginContext(input: {
  agent: Agent;
  modelConfig: ChatContext["modelConfig"];
  resolvedPlugins: ResolvedRuntimePlugin[];
  systemPrompt: string | null;
  thinkingEnabled: boolean;
  userId: string;
}): Promise<RuntimePluginSystemPromptSection[]> {
  if (input.resolvedPlugins.length === 0) {
    return [];
  }

  const systemPromptSections: RuntimePluginSystemPromptSection[] = [];

  for (const resolvedPlugin of input.resolvedPlugins) {
    const result = await resolvedPlugin.plugin.prepareContext?.({
      agent: input.agent,
      modelConfig: input.modelConfig,
      pluginConfig: resolvedPlugin.config,
      systemPrompt: input.systemPrompt,
      thinkingEnabled: input.thinkingEnabled,
      userId: input.userId,
    });

    if (result?.systemPromptSections?.length) {
      systemPromptSections.push(...result.systemPromptSections);
    }
  }

  return systemPromptSections;
}

export function renderSystemPromptSections(
  sections: RuntimePluginSystemPromptSection[],
): string {
  return sections
    .map((section) => {
      return section.title
        ? `## ${section.title}\n${section.content}`
        : section.content;
    })
    .join("\n\n");
}

export async function runOnRunCompleteHooks(input: {
  agentId: string;
  deps: RuntimeDeps;
  resolvedPlugins: ResolvedRuntimePlugin[];
  run: RuntimePluginRunSummary;
  userId: string;
}): Promise<void> {
  if (input.resolvedPlugins.length === 0) {
    return;
  }

  const agent = await input.deps.agents.getById(input.agentId);
  if (!agent) {
    throw new Error(`Agent not found during runtime plugin finalization: ${input.agentId}`);
  }

  for (const resolvedPlugin of input.resolvedPlugins) {
    await resolvedPlugin.plugin.onRunComplete?.({
      agent,
      pluginConfig: resolvedPlugin.config,
      run: input.run,
      userId: input.userId,
    });
  }
}
