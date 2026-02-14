import type { LanguageModel, StreamTextResult } from "ai";
import type { ModelConfig, Agent } from "@/types";

// ============================================================================
// Chat Service Types
// ============================================================================

/**
 * Options for preparing a chat context
 */
export interface ChatPrepareOptions {
  modelId?: string;
  thinkingEnabled?: boolean;
}

/**
 * Options for executing a full chat turn
 */
export interface ExecuteTurnOptions {
  modelId?: string;
  thinkingEnabled?: boolean;
}

/**
 * Context prepared for a chat stream
 */
export interface ChatContext {
  agent: Agent;
  languageModel: LanguageModel;
  modelConfig: ModelConfig;
  tools: Record<string, unknown>;
  providerOptions?: unknown;
  maxOutputTokens?: number;
  systemPrompt: string | null;
  isThinkingActive: boolean;
}

/**
 * Incoming chat message from the client (loose shape from AI SDK frontend)
 */
export interface IncomingChatMessage {
  role: string;
  content?: string;
  parts?: { type: string; text?: string }[];
}

/**
 * Model message format for streamText
 */
export interface ModelMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Result of finishing a chat turn
 */
export interface ChatFinishResult {
  success: boolean;
  error?: string;
}

/**
 * Options for runAgent — discriminated union on streaming mode
 */
export type RunAgentOptions = {
  sessionId: string;
  modelId?: string;
  thinkingEnabled?: boolean;
} & (
  | { streaming: true }
  | { streaming: false; maxTurns?: number }
);

/**
 * Result of runAgent — discriminated union matching options
 */
export type RunAgentResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { streaming: true; stream: StreamTextResult<any, any> }
  | { streaming: false; result: string; reachedMaxTurns: boolean };
