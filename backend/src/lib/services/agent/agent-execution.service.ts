import { generateText, ToolSet } from "ai";
import { getChatService } from "../chat";
import { getAgentService } from "../agent";
import { getItemService, itemsToChatMessages } from "../item";
import { getAgentConfigService } from "../agent-config";
import type { MessageItem } from "@/types";

const MAX_TURNS_DEFAULT = 25;

export class AgentExecutionService {
  async executeSubAgent(
    parentAgentId: string,
    sessionId: string,
    userId: string,
    agentConfigId: string,
    task: string,
    sourceCallId: string
  ): Promise<string> {
    const agentService = getAgentService();
    const itemService = getItemService();

    // Create child agent
    const createResult = await agentService.create({
      sessionId,
      parentId: parentAgentId,
      sourceCallId,
      name: "sub-agent",
      task,
      agentConfigId,
    }, userId);

    if (!("agent" in createResult) || !createResult.agent) {
      throw new Error("Failed to create child agent");
    }

    const childAgentId = createResult.agent.id;

    try {
      await itemService.createMessage(childAgentId, "user", task, userId);

      const chatService = getChatService();
      const context = await chatService.prepareChat(childAgentId, userId);
      if (!context) {
        throw new Error("Failed to prepare chat context for child agent");
      }

      const agentConfigService = getAgentConfigService();
      const agentConfig = agentConfigId ? await agentConfigService.getById(agentConfigId, userId) : null;
      const maxTurns = agentConfig?.maxTurns || MAX_TURNS_DEFAULT;
      const hasTools = Object.keys(context.tools).length > 0;
      let reachedMaxTurns = false;

      for (let turn = 0; turn < maxTurns; turn++) {
        const items = await itemService.getByAgentId(childAgentId);
        const chatMessages = itemsToChatMessages(items);

        const messages = chatService.prependSystemPrompt(
          chatMessages.map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content || "",
          })),
          context.systemPrompt
        );

        const result = await generateText({
          model: context.languageModel,
          messages,
          tools: hasTools ? context.tools as ToolSet : undefined,
          maxOutputTokens: context.maxOutputTokens,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          providerOptions: context.providerOptions as any,
        });

        // Persist assistant text
        if (result.text) {
          await itemService.createMessage(childAgentId, "assistant", result.text);
        }

        // Persist tool calls and results from steps
        if (result.steps) {
          for (const step of result.steps) {
            for (const tc of step.toolCalls) {
              await itemService.createToolCall(
                childAgentId,
                tc.toolCallId,
                tc.toolName,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tc as any).args as Record<string, unknown> | undefined,
                "completed"
              );
            }
            for (const tr of step.toolResults) {
              await itemService.createToolResult(
                childAgentId,
                tr.toolCallId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tr as any).result
              );
            }
          }
        }

        await agentService.update(childAgentId, { turnCount: turn + 1 }, userId);

        const lastStep = result.steps?.[result.steps.length - 1];
        if (!lastStep?.toolCalls?.length) {
          break;
        }

        if (turn === maxTurns - 1) {
          reachedMaxTurns = true;
        }
      }

      const finalItems = await itemService.getByAgentId(childAgentId);
      const lastAssistantItem = [...finalItems].reverse().find(
        (i): i is MessageItem => i.type === "message" && i.role === "assistant"
      );
      let finalResult = lastAssistantItem?.content || "Task completed without response.";
      if (reachedMaxTurns) {
        finalResult += " [max turns reached]";
      }

      await agentService.update(childAgentId, {
        status: "completed",
        result: finalResult,
        completedAt: new Date(),
      }, userId);

      return finalResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sub-agent execution failed";
      await agentService.update(childAgentId, {
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      }, userId);
      return `Error: ${errorMessage}`;
    }
  }

  async continueSubAgent(
    childAgentId: string,
    parentAgentId: string,
    userId: string,
    message: string
  ): Promise<string> {
    const agentService = getAgentService();
    const agent = await agentService.getById(childAgentId, userId);

    if (!agent) {
      return "Error: Agent not found";
    }
    if (agent.parentId !== parentAgentId) {
      return "Error: Agent is not a child of the calling agent";
    }

    const itemService = getItemService();
    await itemService.createMessage(childAgentId, "user", message, userId);

    await agentService.update(childAgentId, { status: "running" }, userId);

    const chatService = getChatService();
    const context = await chatService.prepareChat(childAgentId, userId);
    if (!context) {
      return "Error: Failed to prepare chat context";
    }

    const hasTools = Object.keys(context.tools).length > 0;

    try {
      const agentConfigService = getAgentConfigService();
      const agentConfig = agent.agentConfigId ? await agentConfigService.getById(agent.agentConfigId, userId) : null;
      const maxTurns = agentConfig?.maxTurns || MAX_TURNS_DEFAULT;
      let reachedMaxTurns = false;

      for (let turn = 0; turn < maxTurns; turn++) {
        const items = await itemService.getByAgentId(childAgentId);
        const chatMessages = itemsToChatMessages(items);

        const messages = chatService.prependSystemPrompt(
          chatMessages.map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content || "",
          })),
          context.systemPrompt
        );

        const result = await generateText({
          model: context.languageModel,
          messages,
          tools: hasTools ? context.tools as ToolSet : undefined,
          maxOutputTokens: context.maxOutputTokens,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          providerOptions: context.providerOptions as any,
        });

        if (result.text) {
          await itemService.createMessage(childAgentId, "assistant", result.text);
        }

        if (result.steps) {
          for (const step of result.steps) {
            for (const tc of step.toolCalls) {
              await itemService.createToolCall(
                childAgentId,
                tc.toolCallId,
                tc.toolName,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tc as any).args as Record<string, unknown> | undefined,
                "completed"
              );
            }
            for (const tr of step.toolResults) {
              await itemService.createToolResult(
                childAgentId,
                tr.toolCallId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (tr as any).result
              );
            }
          }
        }

        await agentService.update(childAgentId, {
          turnCount: (agent.turnCount || 0) + turn + 1,
        }, userId);

        const lastStep = result.steps?.[result.steps.length - 1];
        if (!lastStep?.toolCalls?.length) {
          break;
        }

        if (turn === maxTurns - 1) {
          reachedMaxTurns = true;
        }
      }

      const finalItems = await itemService.getByAgentId(childAgentId);
      const lastAssistantItem = [...finalItems].reverse().find(
        (i): i is MessageItem => i.type === "message" && i.role === "assistant"
      );
      let finalResult = lastAssistantItem?.content || "Task completed without response.";
      if (reachedMaxTurns) {
        finalResult += " [max turns reached]";
      }

      await agentService.update(childAgentId, {
        status: "completed",
        result: finalResult,
        completedAt: new Date(),
      }, userId);

      return finalResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Continue failed";
      await agentService.update(childAgentId, {
        status: "failed",
        error: errorMessage,
        completedAt: new Date(),
      }, userId);
      return `Error: ${errorMessage}`;
    }
  }
}

let instance: AgentExecutionService | null = null;

export function getAgentExecutionService(): AgentExecutionService {
  if (!instance) {
    instance = new AgentExecutionService();
  }
  return instance;
}
