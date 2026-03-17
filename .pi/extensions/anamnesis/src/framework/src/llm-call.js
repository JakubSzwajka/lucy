/**
 * Thin LLM call wrapper — direct OpenRouter API, no agent/session overhead.
 * Used by the orchestrator for isolated sub-agent calls (classifier, scorer, generator).
 *
 * @module continuity/llm-call
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Make a single LLM call via OpenRouter.
 *
 * @param {Object} options
 * @param {string} options.systemPrompt - System prompt (SOUL.md content)
 * @param {string} options.message - User message (prompt with data templated in)
 * @param {string} [options.model] - Model identifier (OpenRouter format)
 * @param {number} [options.maxTokens] - Max response tokens
 * @param {number} [options.temperature] - Sampling temperature
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number, totalTokens: number}}>}
 */
export async function llmCall(options) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("[llm-call] OPENROUTER_API_KEY is required");
  }

  const model = options.model ?? process.env.LLM_CALL_MODEL ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.message },
    ],
  };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lucy.dev",
      "X-Title": "Lucy Continuity",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `[llm-call] OpenRouter ${response.status}: ${errorBody.slice(0, 500)}`,
    );
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("[llm-call] empty response from OpenRouter");
  }

  return {
    content,
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Create a sendMessage adapter compatible with the Orchestrator.
 *
 * The orchestrator calls: sendMessage({ agent, message, systemPrompt })
 * This adapter maps that to a direct llmCall, ignoring the agent field.
 *
 * @param {Object} [config] - Override defaults
 * @param {string} [config.model] - Model to use for all calls
 * @returns {Function} sendMessage function for Orchestrator
 */
export function createSendMessage(config = {}) {
  return async ({ message, systemPrompt }) => {
    const result = await llmCall({
      systemPrompt,
      message,
      model: config.model,
    });
    return result.content;
  };
}
