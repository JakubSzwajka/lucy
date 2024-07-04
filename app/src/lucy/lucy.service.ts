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
import { getAgentSystemMessage } from '@/lucy/ai/prompt';
import { LucyToolset } from './lucy.toolset';
import { tools } from './lucy.tools';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { Agent } from './entities/agent.entity';

const CONVERSATIONS_IDS = {
  DEFAULT: 'default',
  NOTIFICATIONS: 'notifications',
};

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly toolset: LucyToolset,
  ) {}

  private readonly MINUTES_OF_CONVERSATION_HISTORY = 10;
  private logPrefix = '';

  async talk({
    query,
    agent,
    options,
  }: {
    query: string;
    agent: Agent;
    options: {
      messageSource: string;
      conversationId: string;
    };
  }): Promise<string> {
    const messageId = v4();
    const conversationId = options.conversationId || CONVERSATIONS_IDS.DEFAULT;
    this.logPrefix = `(convId: ${conversationId} | msgId: ${messageId})`;

    console.debug(`${this.logPrefix} Received query`, query);
    const history = await this.getHistory(conversationId);

    const conversation = history
      .map((message) => {
        return [
          new HumanMessage(message.humanMessage),
          new AIMessage(message.agentMessage),
        ];
      })
      .flat();

    const messages = [
      new SystemMessage(
        getAgentSystemMessage({
          agent,
        }),
      ),
      ...conversation,
      new HumanMessage(query),
    ];

    const activeTools = this.getActiveTools(agent, tools);
    const response = await call(messages, {
      tools: activeTools.length > 0 ? activeTools : undefined,
    });

    let modelResponse = response.content as string;

    if (response.tool_calls && response.tool_calls.length > 0) {
      response.tool_calls = await this.validateToolCalls(response.tool_calls);
      console.debug(
        `${this.logPrefix} Received tool calls`,
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
        conversationId,
        humanMessage: query,
        agentMessage: modelResponse,
        agent: agent,
        user: {
          id: agent.owner.id,
        },
        source: options.messageSource || MessageSource.UNKNOWN,
      });
      await this.messageRepository.save(message);
    } catch (error) {
      console.error(`${this.logPrefix} Error saving message`, error);
    }
    console.debug(`${this.logPrefix} Returning response`, modelResponse);
    return modelResponse;
  }

  private getActiveTools(agent: Agent, tools) {
    const skillsIds = agent.skills.map((skill) => skill.skillId) || [];
    console.debug(`${this.logPrefix} Active skills`, skillsIds);
    return tools.filter((tool) => skillsIds.includes(tool.function.name));
  }

  private async tryToFixToolCall({ toolDefinition, toolCall, errors }) {
    const messages = [
      new SystemMessage(`
      You are assistant to fix generated tool calls in the message. You will get three things. Tool definition, generated tool call, and errors that were found in the tool call. 
      Your task is to generate fixed tool call and send it back. 

      RULES:
      - do not add new tool calls
      - do not add anything that was not in the original tool call
      - do not add any message on the beginning or the end
      - return only json format response.

      `),
      new HumanMessage(`
        Tool definition: ${JSON.stringify(toolDefinition)}
        Tool call: ${JSON.stringify(toolCall)}
        Errors: ${JSON.stringify(errors)}
        `),
    ];

    const response = await call(messages, { jsonResponse: true });
    const fixedToolCall = JSON.parse(response.content as string);
    console.debug(
      `${this.logPrefix} Fixed tool call: . ${JSON.stringify(fixedToolCall)}`,
    );

    return fixedToolCall;
  }

  private async validateToolCalls(toolCalls: ToolCall[]): Promise<ToolCall[]> {
    const validatedToolCalls: any[] = [];
    for (const toolCall of toolCalls) {
      const toolDefinition = tools.find(
        (tool) => tool.function.name === toolCall.name,
      );
      if (!toolDefinition) {
        console.error(
          `${this.logPrefix} Tool definition not found for tool call`,
          toolCall,
        );
        continue;
      }

      const properties =
        toolDefinition?.function?.parameters?.['properties'] || {};

      const errors: string[] = [];
      for (const [key, value] of Object.entries(toolCall.args)) {
        const paramDef = properties[key];
        // if its a string check type..
        const type = paramDef.type;
        const generatedType = typeof value;

        if (type !== generatedType) {
          const error = `Tool call validation failed for ${key}. Expected type ${type} but got ${generatedType}`;
          errors.push(error);
          console.error(`${this.logPrefix} ${error}`);
        }

        // if its an enum check if value is in enum
        if (paramDef.enum) {
          if (!paramDef.enum.includes(value)) {
            const error = `Tool call validation failed for ${key}. Expected value to be in enum [${paramDef.enum}] but got ${value}`;
            errors.push(error);
            console.error(`${this.logPrefix} ${error}`);
          }
        }
      }

      if (errors.length > 0) {
        const fixedToolCall = await this.tryToFixToolCall({
          toolDefinition,
          toolCall,
          errors,
        });
        validatedToolCalls.push(fixedToolCall);
      } else {
        validatedToolCalls.push(toolCall);
      }
    }
    return validatedToolCalls;
  }

  private async getHistory(conversationId: string): Promise<Message[]> {
    // lets keep it clean for notifications. They mostly come from automations and they don't need history.
    let history: Message[] = [];
    if (conversationId === CONVERSATIONS_IDS.NOTIFICATIONS) {
      console.debug(
        `${this.logPrefix} Skipping conversation history for notifications`,
      );
    } else {
      history = await this.messageRepository.find({
        // last 10 minutes
        where: {
          createdAt: Raw((alias) => `${alias} > :date`, {
            date: new Date(
              Date.now() - 1000 * 60 * this.MINUTES_OF_CONVERSATION_HISTORY,
            ),
          }),
          // conversationId,
        },
      });
    }

    console.debug(
      `${this.logPrefix} Retrieved conversation history`,
      history.length,
    );
    return history;
  }
}
