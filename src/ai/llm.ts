import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { env } from 'src/env';
import { LucySystemMessage } from './prompt';

export const call = async (message: string): Promise<string> => {
  const chat = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
  });

  const { content } = await chat.invoke([
    new SystemMessage(LucySystemMessage),
    new HumanMessage(message),
  ]);
  return content as string;
};
