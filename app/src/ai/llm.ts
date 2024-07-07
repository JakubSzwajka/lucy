import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI, OpenAIClient } from '@langchain/openai';
import { env } from '@/lucy/env';

const TAGS = ['lucy', env.NODE_ENV];

export enum Models {
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  GPT_4o = 'gpt-4o',
  GPT_4_turbo = 'gpt-4-turbo',
  GPT_4_1106_preview = 'gpt-4-1106-preview',
}

export const call = async (
  messages: BaseMessage[],
  options: {
    tools?: OpenAIClient.ChatCompletionTool[];
    tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption;
    model?: Models;
    jsonResponse?: boolean;
    additionalTags?: string[];
  } = {},
): Promise<AIMessageChunk> => {
  const {
    tools = undefined,
    tool_choice = undefined,
    model = Models.GPT_4o,
    jsonResponse = false,
    additionalTags = [],
  } = options;
  const tags = additionalTags?.concat(TAGS) || TAGS;
  const chat = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model,
    tags,
  }).bind({
    tools,
    tool_choice,
    response_format: jsonResponse
      ? {
          type: 'json_object',
        }
      : undefined,
  });

  return await chat.invoke(messages);
};
