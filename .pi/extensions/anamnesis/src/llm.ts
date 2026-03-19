// ---------------------------------------------------------------------------
// Anamnesis — LLM call wrapper (OpenRouter)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface LlmCallOptions {
  systemPrompt: string;
  message: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmCallResult {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function llmCall(options: LlmCallOptions): Promise<LlmCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("[llm] OPENROUTER_API_KEY is required");

  const model = options.model ?? process.env.LLM_CALL_MODEL ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lucy.dev",
      "X-Title": "Lucy Anamnesis",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.message },
      ],
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`[llm] OpenRouter ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("[llm] empty response from OpenRouter");

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
