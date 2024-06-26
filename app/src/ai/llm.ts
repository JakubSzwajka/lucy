import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI, OpenAIClient } from '@langchain/openai';
import { env } from '@/lucy/env';

const TAGS = ['lucy', env.NODE_ENV];

export enum Models {
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  GPT_4o = 'gpt-4o',
}

export const call = async (
  messages: BaseMessage[],
  options: {
    tools?: OpenAIClient.ChatCompletionTool[];
    tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption;
    model?: Models;
  } = {
    tools: undefined,
    tool_choice: undefined,
    model: Models.GPT_4o,
  }
): Promise<AIMessageChunk> => {
  const chat = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: Models.GPT_3_5_TURBO,
    tags: TAGS,
  }).bind({
    tools: options.tools,
    tool_choice: options.tool_choice,
  });

  return await chat.invoke(messages);
};
