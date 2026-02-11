import type { LanguageModel } from "ai";
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
