import { getMemorySettings } from "./settings";
import { estimateTokens } from "@/lib/server/ai/tokens";
import { getItemService } from "@/lib/server/services/item";
import { getSessionService } from "@/lib/server/services/session";
import { getChatService } from "@/lib/server/services/chat/chat.service";
import type { Item } from "@/types";
import type { MemorySettings } from "./types";
import { startActiveObservation, updateActiveTrace, propagateAttributes } from "@langfuse/tracing";

// ============================================================================
// Auto Reflection Service
// ============================================================================
// Triggers memory reflection automatically based on token accumulation.
// Runs as a fire-and-forget background task after each chat turn.
//
// The source of truth is `lastReflectionItemCount` on the session — the item
// index where the last reflection ended. The "window" of unreflected content
// is items[lastReflectionItemCount:]. Its token size is computed fresh each
// call (no accumulator to drift). `reflectionTokenCount` is persisted only
// as a cache for the frontend progress indicator.
//
// Reflection is performed by a dedicated agent (configured via
// reflectionAgentConfigId in memory settings) which runs non-streaming
// via ChatService.runAgent(). The agent's tools and system prompt are
// determined by its agent config.
//
// See: src/lib/memory/README.md

// In-memory mutex to prevent concurrent reflections per session.
const reflecting = new Set<string>();

/**
 * Entry point — called fire-and-forget from ChatService.onFinish.
 * Computes unreflected token count and triggers reflection when threshold is met.
 */
export async function maybeAutoReflect(
  sessionId: string,
  userId: string,
  agentId: string,
): Promise<void> {
  const settings = await getMemorySettings(userId);
  if (!settings.autoExtract) return;

  if (reflecting.has(sessionId)) return;

  const sessionService = getSessionService();
  const session = await sessionService.getById(sessionId, userId);
  if (!session) return;

  // Compute tokens in the unreflected window: items[lastReflectionItemCount:]
  const items = await getItemService().getByAgentId(agentId);
  const unreflectedItems = items.slice(session.lastReflectionItemCount);
  const windowTokens = countItemTokens(unreflectedItems);

  // Persist as cache for the frontend indicator.
  await sessionService.update(sessionId, {
    reflectionTokenCount: windowTokens,
  }, userId);

  if (windowTokens < settings.reflectionTokenThreshold) {
    return;
  }

  // Threshold met — run reflection agent on the unreflected window, then slide forward.
  await runReflection(sessionId, userId, agentId, settings, session.lastReflectionItemCount, items.length);
}

/**
 * Runs a reflection agent, then advances the reflection window.
 * Always slides the window forward when done (even on failure or empty results)
 * so we don't re-trigger every subsequent turn on the same content.
 */
async function runReflection(
  sessionId: string,
  userId: string,
  agentId: string,
  settings: MemorySettings,
  windowStartIndex: number,
  currentItemCount: number,
): Promise<void> {
  if (!settings.reflectionAgentConfigId) {
    console.warn("[Auto-reflection] No reflectionAgentConfigId configured, skipping reflection for session", sessionId);
    return;
  }

  reflecting.add(sessionId);
  const sessionService = getSessionService();
  try {
    await startActiveObservation("auto-reflection", async (span) => {
      // Set trace-level identity so this appears as a distinct trace in Langfuse
      updateActiveTrace({
        name: "auto-reflection",
        userId,
        sessionId,
        tags: ["reflection"],
      });
      span.update({ input: { sessionId, userId, currentItemCount } });

      // Build transcript from unreflected items
      const items = await getItemService().getByAgentId(agentId);
      const unreflectedItems = items.slice(windowStartIndex, currentItemCount);
      const transcript = formatTranscript(unreflectedItems);

      // Create a dedicated reflection session with the reflection agent config
      const { session: reflectionSession } = await sessionService.create(userId, {
        agentConfigId: settings.reflectionAgentConfigId!,
        agentName: "reflection-agent",
        parentSessionId: sessionId,
      });

      if (!reflectionSession?.rootAgentId) {
        console.error("[Auto-reflection] Failed to create reflection session for", sessionId);
        return;
      }

      // Persist the user message so runAgent's DB-read loop can see it
      await getItemService().create(reflectionSession.rootAgentId, {
        type: "message",
        role: "user",
        content: transcript,
      });

      // Run the reflection agent non-streaming with trace propagation
      const chatService = getChatService();
      const result = await propagateAttributes({
        userId,
        sessionId: reflectionSession.id,
        metadata: {
          agentId: reflectionSession.rootAgentId,
          sourceSessionId: sessionId,
          type: "reflection",
        },
      }, async () => {
        return await chatService.runAgent(reflectionSession.rootAgentId!, userId, [], {
          sessionId: reflectionSession.id,
          streaming: false,
        });
      });

      if (!result.streaming) {
        span.update({ output: { result: result.result } });
        console.log("[Auto-reflection] Reflection completed for session %s", sessionId);
      }
    }, { asType: "chain" });
  } catch (error) {
    console.error("[Auto-reflection] Reflection failed for session", sessionId, error);
  } finally {
    // Slide window forward + reset cached token count.
    await sessionService.update(sessionId, {
      lastReflectionItemCount: currentItemCount,
      reflectionTokenCount: 0,
    }, userId).catch(() => {});
    reflecting.delete(sessionId);
  }
}

/**
 * Format items as a plain-text transcript for the reflection agent.
 */
function formatTranscript(items: Item[]): string {
  const lines: string[] = [];
  for (const item of items) {
    switch (item.type) {
      case "message":
        if (item.content) {
          lines.push(`${item.role}: ${item.content}`);
        }
        break;
      case "tool_call":
        lines.push(`assistant [tool_call ${item.toolName}]: ${JSON.stringify(item.toolArgs ?? {})}`);
        break;
      case "tool_result":
        if (item.toolOutput) {
          lines.push(`tool [${item.callId}]: ${item.toolOutput}`);
        }
        if (item.toolError) {
          lines.push(`tool [${item.callId}] error: ${item.toolError}`);
        }
        break;
    }
  }
  return lines.join("\n");
}

function countItemTokens(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    switch (item.type) {
      case "message":
        if (item.content) total += estimateTokens(item.content);
        break;
      case "tool_call":
        total += estimateTokens(item.toolName);
        if (item.toolArgs) total += estimateTokens(JSON.stringify(item.toolArgs));
        break;
      case "tool_result":
        if (item.toolOutput) total += estimateTokens(item.toolOutput);
        if (item.toolError) total += estimateTokens(item.toolError);
        break;
      case "reasoning":
        if (item.reasoningContent) total += estimateTokens(item.reasoningContent);
        break;
    }
  }
  return total;
}
