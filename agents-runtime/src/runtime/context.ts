import { EnvironmentContextService } from "../environment-context.js";
import {
  preparePluginContext,
  renderSystemPromptSections,
} from "../plugins/lifecycle.js";
import type {
  Agent,
  AgentConfigWithTools,
  ChatContext,
  ResolvedRuntimePlugin,
  RuntimeDeps,
} from "../types.js";

function appendPromptSection(
  systemPrompt: string | null,
  section: string,
): string {
  return systemPrompt
    ? `${systemPrompt}\n\n${section}`
    : section;
}

async function resolveSystemPrompt(
  deps: RuntimeDeps,
  agent: Agent,
  agentConfig: AgentConfigWithTools | null,
): Promise<string | null> {
  if (agent.systemPrompt) {
    return agent.systemPrompt;
  }
  if (agentConfig?.systemPromptId) {
    const prompt = await deps.config.getSystemPrompt(agentConfig.systemPromptId);
    if (prompt?.content) return prompt.content;
  }
  return null;
}

async function injectIdentityContext(
  deps: RuntimeDeps,
  systemPrompt: string | null,
  userId: string,
): Promise<string | null> {
  try {
    const identity = await deps.identity.getActive(userId);
    if (!identity?.content) {
      return systemPrompt;
    }

    const c = identity.content;
    const parts: string[] = [];
    if (c.values?.length) parts.push(`Values: ${c.values.join("; ")}`);
    if (c.capabilities?.length) parts.push(`Capabilities: ${c.capabilities.join("; ")}`);
    if (c.keyRelationships?.length) {
      parts.push(
        `Key relationships: ${c.keyRelationships.map((r) => `${r.name} (${r.nature})`).join("; ")}`,
      );
    }
    if (c.growthNarrative) parts.push(`Growth narrative: ${c.growthNarrative}`);
    if (parts.length === 0) {
      return systemPrompt;
    }

    return appendPromptSection(systemPrompt, `## User Identity\n${parts.join("\n")}`);
  } catch {
    return systemPrompt;
  }
}

function injectEnvironmentContext(systemPrompt: string | null): string | null {
  try {
    const envService = new EnvironmentContextService();
    const envSection = envService.buildContext();
    return envSection
      ? appendPromptSection(systemPrompt, envSection)
      : systemPrompt;
  } catch {
    return systemPrompt;
  }
}

export async function prepareRuntimeContext(params: {
  agentId: string;
  deps: RuntimeDeps;
  options: { modelId?: string; thinkingEnabled?: boolean };
  resolvedPlugins: ResolvedRuntimePlugin[];
  userId: string;
}): Promise<ChatContext | null> {
  const { agentId, deps, options, resolvedPlugins, userId } = params;
  const { modelId, thinkingEnabled = true } = options;

  const agent = await deps.agents.getById(agentId);
  if (!agent) return null;

  let agentConfig: AgentConfigWithTools | null = null;
  if (agent.agentConfigId) {
    agentConfig = await deps.config.getAgentConfig(agent.agentConfigId);
  }

  const defaultModel = process.env.DEFAULT_MODEL ?? "anthropic/claude-sonnet-4.6";
  const effectiveModelId = modelId || agent.model || agentConfig?.defaultModelId || defaultModel;

  const modelConfig = await deps.models.getModelConfig(effectiveModelId);
  if (!modelConfig) {
    throw new Error(`Unknown model: ${effectiveModelId}`);
  }

  const languageModel = deps.models.getLanguageModel(modelConfig);
  let systemPrompt = await resolveSystemPrompt(deps, agent, agentConfig);
  systemPrompt = injectEnvironmentContext(systemPrompt);
  systemPrompt = await injectIdentityContext(deps, systemPrompt, userId);

  const isThinkingActive = (modelConfig.supportsReasoning && thinkingEnabled) ?? false;
  const pluginSystemPromptSections = await preparePluginContext({
    agent,
    modelConfig,
    resolvedPlugins,
    systemPrompt,
    thinkingEnabled,
    userId,
  });

  if (pluginSystemPromptSections.length > 0) {
    systemPrompt = appendPromptSection(
      systemPrompt,
      renderSystemPromptSections(pluginSystemPromptSections),
    );
  }

  return {
    agent,
    isThinkingActive,
    languageModel,
    maxOutputTokens: undefined,
    modelConfig,
    providerOptions: deps.models.buildProviderOptions(modelConfig, thinkingEnabled),
    systemPrompt,
    tools: {},
  };
}
