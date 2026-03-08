import type { LanguageModelV1ProviderMetadata } from "@ai-sdk/provider";
import { generateText, streamText, type CoreMessage, type ToolSet } from "ai";
import {
  applySlidingWindow,
  itemsToFullModelMessages,
  prependSystemPrompt,
  stripImageParts,
} from "../messages.js";
import { runOnRunCompleteHooks } from "../plugins/lifecycle.js";
import { persistStepContent, type ContentPart } from "../step-persistence.js";
import type {
  AgentStatus,
  ChatContext,
  MessageItem,
  ModelMessage,
  ResolvedRuntimePlugin,
  RunResult,
  RuntimeDeps,
  RuntimePluginRunSummary,
} from "../types.js";

/**
 * Runtime shape of tool results from the AI SDK's StepResult.
 * The SDK types resolve to `never` when tools are dynamically provided
 * (typed as ToolSet / Record<string, unknown>), but at runtime these
 * objects always carry these fields.
 */
interface RuntimeToolResult {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
}

async function finalizeRun(params: {
  agentId: string;
  agentStatus: AgentStatus;
  deps: RuntimeDeps;
  onFinish?: () => Promise<void>;
  resolvedPlugins: ResolvedRuntimePlugin[];
  run: RuntimePluginRunSummary;
  userId: string;
}): Promise<void> {
  const {
    agentId,
    agentStatus,
    deps,
    onFinish,
    resolvedPlugins,
    run,
    userId,
  } = params;

  const completionTimestamp = new Date();
  const update = run.status === "failed"
    ? {
      completedAt: completionTimestamp,
      error: run.error ?? "Agent execution failed",
      status: agentStatus,
    }
    : {
      completedAt: completionTimestamp,
      result: run.output,
      status: agentStatus,
    };

  await deps.agents.update(agentId, update);

  try {
    await runOnRunCompleteHooks({
      agentId,
      deps,
      resolvedPlugins,
      run,
      userId,
    });
    if (onFinish) {
      await onFinish();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Runtime plugin finalization failed";
    await deps.agents.update(agentId, {
      completedAt: completionTimestamp,
      error: errorMessage,
      status: "failed",
    });
    throw error;
  }
}

export function runStreamingAgent(params: {
  agentId: string;
  context: ChatContext;
  deps: RuntimeDeps;
  messages: ModelMessage[];
  onFinish?: () => Promise<void>;
  resolvedPlugins: ResolvedRuntimePlugin[];
  userId: string;
}): Extract<RunResult, { streaming: true }> {
  const {
    agentId,
    context,
    deps,
    messages,
    onFinish,
    resolvedPlugins,
    userId,
  } = params;

  const sanitizedMessages = context.modelConfig.supportsImages === false
    ? stripImageParts(messages)
    : messages;

  const messagesWithSystem = prependSystemPrompt(sanitizedMessages, context.systemPrompt);
  const hasTools = Object.keys(context.tools).length > 0;

  const result = streamText({
    model: context.languageModel,
    messages: messagesWithSystem as CoreMessage[],
    tools: hasTools ? context.tools as ToolSet : undefined,
    maxSteps: hasTools ? 10 : 1,
    maxTokens: context.maxOutputTokens,
    providerOptions: context.providerOptions as LanguageModelV1ProviderMetadata,
    onStepFinish: async (stepResult) => {
      const contentParts: ContentPart[] = [];
      if (stepResult.reasoning) {
        contentParts.push({ type: "reasoning", text: stepResult.reasoning });
      }
      if (stepResult.text) {
        contentParts.push({ type: "text", text: stepResult.text });
      }
      for (const tc of stepResult.toolCalls) {
        contentParts.push({
          type: "tool-call",
          input: (tc.args ?? {}) as Record<string, unknown>,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
        });
      }
      for (const tr of stepResult.toolResults as RuntimeToolResult[]) {
        contentParts.push({
          type: "tool-result",
          output: tr.result,
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
        });
      }
      if (contentParts.length > 0) {
        await persistStepContent(deps.items, agentId, contentParts);
      }
    },
    onFinish: async ({ text }) => {
      await finalizeRun({
        agentId,
        agentStatus: "waiting",
        deps,
        onFinish,
        resolvedPlugins,
        run: {
          output: text || undefined,
          status: "completed",
        },
        userId,
      });
    },
  });

  return { stream: result, streaming: true };
}

export async function runNonStreamingAgent(params: {
  abortController: AbortController;
  agentId: string;
  context: ChatContext;
  deps: RuntimeDeps;
  maxTurns: number;
  onFinish?: () => Promise<void>;
  resolvedPlugins: ResolvedRuntimePlugin[];
  userId: string;
}): Promise<Extract<RunResult, { streaming: false }>> {
  const {
    abortController,
    agentId,
    context,
    deps,
    maxTurns,
    onFinish,
    resolvedPlugins,
    userId,
  } = params;

  const hasTools = Object.keys(context.tools).length > 0;
  let executionError: unknown;
  let finalResult = "Task completed without response.";
  let reachedMaxTurns = false;
  let runSummary: RuntimePluginRunSummary = {
    output: finalResult,
    status: "completed",
  };

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (abortController.signal.aborted) break;

      const items = await deps.items.getByAgentId(agentId);
      const windowedItems = applySlidingWindow(items);
      const turnModelMessages = itemsToFullModelMessages(windowedItems);

      const turnMessages: CoreMessage[] = context.systemPrompt
        ? [{ role: "system", content: context.systemPrompt } as CoreMessage, ...turnModelMessages as CoreMessage[]]
        : turnModelMessages as CoreMessage[];

      const result = await generateText({
        model: context.languageModel,
        messages: turnMessages,
        tools: hasTools ? context.tools as ToolSet : undefined,
        maxTokens: context.maxOutputTokens,
        abortSignal: abortController.signal,
        providerOptions: context.providerOptions as LanguageModelV1ProviderMetadata,
      });

      if (result.steps) {
        for (const step of result.steps) {
          const contentParts: ContentPart[] = [];
          if (step.reasoning) {
            contentParts.push({ type: "reasoning", text: step.reasoning });
          }
          if (step.text) {
            contentParts.push({ type: "text", text: step.text });
          }
          for (const tc of step.toolCalls) {
            contentParts.push({
              type: "tool-call",
              input: (tc.args ?? {}) as Record<string, unknown>,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
            });
          }
          for (const tr of step.toolResults as RuntimeToolResult[]) {
            contentParts.push({
              type: "tool-result",
              output: tr.result,
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
            });
          }
          if (contentParts.length > 0) {
            await persistStepContent(deps.items, agentId, contentParts);
          }
        }
      } else if (result.text) {
        await deps.items.createMessage(agentId, { role: "assistant", content: result.text });
      }

      await deps.agents.update(agentId, { turnCount: turn + 1 });

      const lastStep = result.steps?.[result.steps.length - 1];
      if (!lastStep?.toolCalls?.length) break;

      if (turn === maxTurns - 1) reachedMaxTurns = true;
    }

    const wasCancelled = abortController.signal.aborted;
    const finalItems = await deps.items.getByAgentId(agentId);
    const lastAssistantItem = [...finalItems].reverse().find(
      (i): i is MessageItem => i.type === "message" && i.role === "assistant",
    );
    finalResult = lastAssistantItem?.content || "Task completed without response.";
    if (wasCancelled) finalResult += " [cancelled]";
    else if (reachedMaxTurns) finalResult += " [max turns reached]";
    runSummary = {
      output: finalResult,
      reachedMaxTurns,
      status: wasCancelled ? "cancelled" : "completed",
    };
  } catch (error) {
    if (abortController.signal.aborted) {
      finalResult = "Execution cancelled by user";
      runSummary = {
        output: finalResult,
        status: "cancelled",
      };
    } else {
      executionError = error;
      runSummary = {
        error: error instanceof Error ? error.message : "Agent execution failed",
        status: "failed",
      };
    }
  }

  await finalizeRun({
    agentId,
    agentStatus: runSummary.status,
    deps,
    onFinish,
    resolvedPlugins,
    run: runSummary,
    userId,
  });

  if (executionError) {
    throw executionError;
  }

  return { reachedMaxTurns, result: finalResult, streaming: false };
}
