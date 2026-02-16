import { getExtractionService } from "./extraction.service";
import { getMemorySettings } from "./settings";
import { estimateTokens } from "@/lib/ai/tokens";
import { getItemService } from "@/lib/services/item";
import { getSessionService } from "@/lib/services/session";
import type { Item } from "@/types";
import type { MemorySettings } from "./types";
import { startActiveObservation } from "@langfuse/tracing";

// ============================================================================
// Auto Reflection Service
// ============================================================================
// Triggers memory extraction automatically based on token accumulation.
// Runs as a fire-and-forget background task after each chat turn.
//
// The source of truth is `lastReflectionItemCount` on the session — the item
// index where the last reflection ended. The "window" of unreflected content
// is items[lastReflectionItemCount:]. Its token size is computed fresh each
// call (no accumulator to drift). `reflectionTokenCount` is persisted only
// as a cache for the frontend progress indicator.
//
// See: backend/src/lib/memory/README.md

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

  // Threshold met — run extraction, then slide the window forward.
  await runReflection(sessionId, userId, agentId, settings, items.length);
}

/**
 * Runs extraction + auto-confirm, then advances the reflection window.
 * Always slides the window forward when done (even on failure or empty results)
 * so we don't re-trigger every subsequent turn on the same content.
 */
async function runReflection(
  sessionId: string,
  userId: string,
  agentId: string,
  settings: MemorySettings,
  currentItemCount: number,
): Promise<void> {
  reflecting.add(sessionId);
  const sessionService = getSessionService();
  try {
    await startActiveObservation("auto-reflection", async (span) => {
      span.update({ input: { sessionId, userId, currentItemCount } });

      const extraction = await getExtractionService().extract(userId, sessionId);

      const hasResults = extraction.memories.length > 0 || extraction.questions.length > 0;
      if (hasResults) {
        const threshold = settings.autoSaveThreshold;
        await getExtractionService().confirm(userId, {
          sessionId,
          approvedMemories: extraction.memories.map((m) => ({
            ...m,
            approved: m.confidenceScore >= threshold,
          })),
          approvedQuestions: extraction.questions.map((q) => ({
            ...q,
            approved: q.curiosityScore >= threshold,
          })),
        });
        const savedMemories = extraction.memories.filter((m) => m.confidenceScore >= threshold).length;
        const savedQuestions = extraction.questions.filter((q) => q.curiosityScore >= threshold).length;
        span.update({ output: { savedMemories, savedQuestions, totalProposed: extraction.memories.length } });
        console.log("[Auto-reflection] Saved %d memories, %d questions for session %s", savedMemories, savedQuestions, sessionId);
      } else {
        span.update({ output: { savedMemories: 0, savedQuestions: 0, totalProposed: 0 } });
        console.log("[Auto-reflection] Nothing extracted for session", sessionId);
      }
    }, { asType: "chain" });
  } catch (error) {
    console.error("[Auto-reflection] Extraction failed for session", sessionId, error);
  } finally {
    // Slide window forward + reset cached token count.
    await sessionService.update(sessionId, {
      lastReflectionItemCount: currentItemCount,
      reflectionTokenCount: 0,
    }, userId).catch(() => {});
    reflecting.delete(sessionId);
  }
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
