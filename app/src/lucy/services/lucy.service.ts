import { Injectable } from '@nestjs/common';
import { call } from '@/lucy/ai';
import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Message,
  MessageSource,
  MessageType,
} from '../entities/message.entity';
import { Repository } from 'typeorm';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { getAgentSystemMessage } from '@/lucy/ai/prompt';
import { Agent } from '../entities/agent.entity';
import { ToolsService } from './tools.service';
import { ConversationService } from './conversation.service';
import { User } from '../entities/user.entity';
import { MessageReceivedEvent } from '@/lucy/events/messageReceived.event';
import { EventBus } from '@nestjs/cqrs';

const CONVERSATIONS_IDS = {
  DEFAULT: 'default',
  NOTIFICATIONS: 'notifications',
};

type ToolCallResult = {
  tool: {
    id: string;
    name: string;
  };
  toolResult: any;
};

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly toolsService: ToolsService,
    private readonly conversationService: ConversationService,
    private readonly eventBus: EventBus,
  ) {}
  private logPrefix = '';

  async talk({
    query,
    agent,
    user,
    options,
  }: {
    query: string;
    agent: Agent;
    user: User;
    options: {
      messageSource: string;
      conversationId: string;
    };
  }): Promise<string> {
    const messageId = v4();
    const conversationId = options.conversationId || CONVERSATIONS_IDS.DEFAULT;
    this.logPrefix = `(convId: ${conversationId} | msgId: ${messageId})`;
    const tools = this.toolsService.getActiveTools(agent);

    const conversation: BaseMessage[] = [
      new SystemMessage(
        getAgentSystemMessage({
          agent,
        }),
      ),
    ];

    console.debug(`${this.logPrefix} Received query`, query);
    await this.messageRepository.save({
      text: query,
      type: MessageType.HUMAN,
      conversationId,
      user,
      agent,
      source: options.messageSource || MessageSource.UNKNOWN,
    });

    const history = await this.conversationService.getHistory(conversationId);
    history.forEach((message: Message) => {
      if (message.type === MessageType.HUMAN)
        conversation.push(new HumanMessage(message.text));
      if (message.type === MessageType.AGENT)
        conversation.push(new AIMessage(message.text));
    });
    conversation.push(new HumanMessage(query));

    await this.eventBus.publish(
      new MessageReceivedEvent({
        user,
        conversation,
      }),
    );

    const modelResponse = await call(conversation, {
      tools,
    });
    conversation.push(new AIMessage(modelResponse));

    if (modelResponse.tool_calls && modelResponse.tool_calls.length > 0) {
      if (modelResponse.tool_calls.length > 1) {
        console.warn(`${this.logPrefix} More than one tool call found`);
      }
      modelResponse.tool_calls = await this.toolsService.validate(
        modelResponse.tool_calls,
      );
      const toolResults: ToolCallResult[] = await this.toolsService.useTool(
        modelResponse.tool_calls,
      );
      for (const toolResult of toolResults) {
        conversation.push(
          new ToolMessage({
            content: JSON.stringify(toolResult.toolResult),
            tool_call_id: toolResult.tool.id,
            name: toolResult.tool.name,
          }),
        );
      }
      const { content } = await call(conversation);
      await this.messageRepository.save({
        text: content as string,
        type: MessageType.AGENT,
        conversationId,
        user,
        agent,
        source: options.messageSource || MessageSource.UNKNOWN,
      });
      return content as string;
    } else {
      await this.messageRepository.save({
        text: modelResponse.content as string,
        type: MessageType.AGENT,
        conversationId,
        user,
        agent,
        source: options.messageSource || MessageSource.UNKNOWN,
      });
      return modelResponse.content as string;
    }
  }
}
