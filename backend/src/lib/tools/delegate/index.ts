import { z } from "zod";
import type { ToolDefinition, DelegateToolSource } from "../types";
import type { AgentConfigWithTools } from "@/types";
import { getAgentConfigService } from "@/lib/services";
import { getSessionService } from "@/lib/services/session";
import { getItemService } from "@/lib/services/item";
import { getChatService } from "@/lib/services/chat";

export async function generateDelegateTools(
  agentConfig: AgentConfigWithTools,
  sessionId: string,
  userId: string,
  _parentAgentId: string
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

        const childSession = await getSessionService().create(userId, {
          title: task.slice(0, 80),
          agentConfigId: targetConfigId,
          parentSessionId: sessionId,
          sourceCallId: context.callId,
        });

        const rootAgentId = childSession.session?.rootAgentId;
        if (!childSession.session || !rootAgentId) {
          return "Error: Failed to create child session";
        }

        await getItemService().createMessage(rootAgentId, "user", task, userId);

        try {
          const result = await getChatService().runAgent(rootAgentId, userId, [], {
            sessionId: childSession.session.id,
            streaming: false,
            maxTurns: entry.maxTurns,
          });
          return result.streaming ? "Error: Unexpected streaming result" : result.result;
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : "Sub-agent execution failed"}`;
        }
      },
    });
  }

  // Continue a conversation with a previously delegated sub-agent
  tools.push({
    name: "continue_session",
    description: "Continue a conversation with a previously delegated sub-agent session",
    inputSchema: z.object({
      sessionId: z.string().describe("The ID of the child session to continue"),
      message: z.string().describe("The follow-up message to send"),
    }),
    source: {
      type: "delegate",
      configId: "continue",
      configName: "continue_session",
    },
    execute: async (args) => {
      const { sessionId: childSessionId, message } = args as { sessionId: string; message: string };

      const session = await getSessionService().getById(childSessionId, userId);
      if (!session) return "Error: Session not found";
      if (session.parentSessionId !== sessionId) return "Error: Session is not a child of the calling session";
      if (!session.rootAgentId) return "Error: Session has no root agent";

      await getItemService().createMessage(session.rootAgentId, "user", message, userId);

      try {
        const result = await getChatService().runAgent(session.rootAgentId, userId, [], {
          sessionId: childSessionId,
          streaming: false,
        });
        return result.streaming ? "Error: Unexpected streaming result" : result.result;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Continue failed"}`;
      }
    },
  });

  return tools;
}
