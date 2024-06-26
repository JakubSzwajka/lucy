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
import { LucyToolset, Tools } from './lucy.toolset';
import { OpenAIClient } from '@langchain/openai';

const tools: OpenAIClient.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: Tools.GET_TASKS,
      description: 'Get a list of tasks',
      parameters: {
        type: 'object',
        properties: {
          due: {
            type: 'string',
            enum: ['today | overdue'],
            description: 'Due date of the tasks.',
          },
        },
        required: ['due'],
      },
    },
  },
];

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly toolset: LucyToolset
  ) {}

  private readonly MINUTES_OF_CONVERSATION_HISTORY = 10;

  async talk(query: string): Promise<string> {
    const history = await this.messageRepository.find({
      // last 10 minutes
      where: {
        createdAt: Raw((alias) => `${alias} > :date`, {
          date: new Date(
            Date.now() - 1000 * 60 * this.MINUTES_OF_CONVERSATION_HISTORY
          ),
        }),
      },
    });

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
          })
        );
      }

      const { content } = await call(messages);
      modelResponse = content as string;
    }

    try {
      const message = this.messageRepository.create({
        conversationId: v4(),
        human: query,
        agent: modelResponse,
        source: MessageSource.SLACK,
      });
      await this.messageRepository.save(message);
    } catch (error) {
      console.error('Error saving message', error);
    }
    return modelResponse;
  }
}
