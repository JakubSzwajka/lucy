import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { env } from 'src/env';
import { LucySystemMessage } from './prompt';
import { Message } from 'src/lucy/entities/message.entity';

export const call = async (
  message: string,
  conversationHistory: Message[],
): Promise<string> => {
  const chat = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
  });

  const conversation = conversationHistory
    .map((message) => {
      return [new HumanMessage(message.human), new AIMessage(message.agent)];
    })
    .flat();

  const { content } = await chat.invoke([
    new SystemMessage(LucySystemMessage),
    ...conversation,
    new HumanMessage(message),
  ]);
  return content as string;
};
