import { z } from "zod";
import type { ToolDefinition, DelegateToolSource } from "../types";
import { getAgentExecutionService } from "@/lib/services/agent/agent-execution.service";
import type { AgentConfigWithTools } from "@/types";
import { getAgentConfigService } from "@/lib/services";

export async function generateDelegateTools(
  agentConfig: AgentConfigWithTools,
  sessionId: string,
  userId: string,
  parentAgentId: string
): Promise<ToolDefinition[]> {
  const delegateEntries = agentConfig.tools.filter(t => t.toolType === "delegate");
  if (delegateEntries.length === 0) return [];

  const tools: ToolDefinition[] = [];
  const agentConfigService = getAgentConfigService();
  const targetConfigs = await agentConfigService.getByIds(delegateEntries.map(e => e.toolRef), userId);
  
  for (const entry of targetConfigs) {
    const formattedName = entry.name.toLowerCase().replace(/ /g, "_");
    const toolName = `delegate_to_${formattedName}`;
    const toolDescription = entry.description || `Delegate a task to a specialized sub-agent`;
    const targetConfigId = entry.id;

    const source: DelegateToolSource = {
      type: "delegate",
      configId: targetConfigId,
      configName: formattedName,
    };
    tools.push({
      name: toolName,
      description: toolDescription,
      inputSchema: z.object({
        task: z.string().describe("The task to delegate to the sub-agent"),
      }),
      source,
      execute: async (args, context) => {
        const { task } = args as { task: string };
        const executionService = getAgentExecutionService();
        return executionService.executeSubAgent(
          parentAgentId,
          sessionId,
          userId,
          targetConfigId,
          task,
          context.callId
        );
      },
    });

  }


  // Add continue_agent tool
  tools.push({
    name: "continue_agent",
    description: "Continue a conversation with a previously delegated sub-agent",
    inputSchema: z.object({
      agentId: z.string().describe("The ID of the sub-agent to continue"),
      message: z.string().describe("The follow-up message to send"),
    }),
    source: {
      type: "delegate",
      configId: "continue",
      configName: "continue_agent",
    },
    execute: async (args) => {
      const { agentId, message } = args as { agentId: string; message: string };
      const executionService = getAgentExecutionService();
      return executionService.continueSubAgent(
        agentId,
        parentAgentId,
        userId,
        message
      );
    },
  });

  return tools;
}
