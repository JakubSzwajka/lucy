/**
 * Token estimation utilities for context tracking.
 * Uses a universal approximation that works across providers.
 */

/**
 * Estimates the number of tokens in a text string.
 * Blends word-based and character-based estimates for better accuracy
 * across different content types (prose, code, special characters).
 *
 * Accuracy: ~80-90% for English text, less accurate for code-heavy content.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;

  // Blend word-based (~1.3 tokens/word) and char-based (~4 chars/token) estimates
  return Math.ceil((words * 1.3 + chars / 4) / 2);
}

/**
 * Estimates tokens for an array of messages (conversation history).
 * Adds overhead for message formatting/role tokens.
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>
): number {
  const contentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // Add ~4 tokens overhead per message for role/formatting
  const overheadTokens = messages.length * 4;

  return contentTokens + overheadTokens;
}

/**
 * Returns the context usage as a ratio (0-1) and formatted strings.
 */
export function getContextUsage(
  currentTokens: number,
  maxTokens: number
): {
  ratio: number;
  percentage: number;
  formatted: string;
  isNearLimit: boolean;
  isOverLimit: boolean;
} {
  const ratio = currentTokens / maxTokens;
  const percentage = Math.round(ratio * 100);

  return {
    ratio,
    percentage,
    formatted: `${formatTokenCount(currentTokens)} / ${formatTokenCount(maxTokens)}`,
    isNearLimit: ratio > 0.8,
    isOverLimit: ratio > 1,
  };
}

/**
 * Formats token count for display (e.g., 128000 -> "128K").
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  }
  return tokens.toString();
}
