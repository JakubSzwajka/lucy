import { Injectable } from '@nestjs/common';
import { call } from '@/lucy/ai';
import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Message, MessageSource } from './entities/message.entity';
import { Repository, Raw } from 'typeorm';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { LucySystemMessage } from '@/lucy/ai/prompt';
import { LucyToolset } from './lucy.toolset';
import { tools } from './lucy.tools';

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly toolset: LucyToolset,
  ) {}

  private readonly MINUTES_OF_CONVERSATION_HISTORY = 10;

  async talk(
    query: string,
    options: {
      messageSource: string;
    },
  ): Promise<string> {
    const messageId = v4();
    console.debug(`(msgId: ${messageId}) Received query`, query);
    const history = await this.messageRepository.find({
      // last 10 minutes
      where: {
        createdAt: Raw((alias) => `${alias} > :date`, {
          date: new Date(
            Date.now() - 1000 * 60 * this.MINUTES_OF_CONVERSATION_HISTORY,
          ),
        }),
      },
    });
    console.debug(
      `(msgId: ${messageId}) Retrieved conversation history`,
      history.length,
    );

    const conversation = history
      .map((message) => {
        return [new HumanMessage(message.human), new AIMessage(message.agent)];
      })
      .flat();

    const messages = [
      new SystemMessage(LucySystemMessage),
      ...conversation,
      new HumanMessage(query),
    ];

    const response = await call(messages, {
      tools,
    });

    let modelResponse = response.content as string;

    if (response.tool_calls && response.tool_calls.length > 0) {
      console.debug(
        `(msgId: ${messageId}) Received tool calls`,
        response.tool_calls,
      );
      messages.push(new AIMessage(response));
      const toolResults: {
        tool: {
          id: string;
          name: string;
        };
        toolResult: any;
      }[] = await this.toolset.useTool(response.tool_calls);

      for (const toolResult of toolResults) {
        messages.push(
          new ToolMessage({
            content: JSON.stringify(toolResult.toolResult),
            tool_call_id: toolResult.tool.id,
            name: toolResult.tool.name,
          }),
        );
      }

      const { content } = await call(messages);
      modelResponse = content as string;
    }

    try {
      const message = this.messageRepository.create({
        id: messageId,
        conversationId: v4(),
        human: query,
        agent: modelResponse,
        source: options.messageSource || MessageSource.UNKNOWN,
      });
      await this.messageRepository.save(message);
    } catch (error) {
      console.error(`(msgId: ${messageId}) Error saving message`, error);
    }
    console.debug(`(msgId: ${messageId}) Returning response`, modelResponse);
    return modelResponse;
  }
}
