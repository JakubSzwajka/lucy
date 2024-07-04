import { call } from '@/lucy/ai';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Agent } from '../entities/agent.entity';
import { OpenAIClient } from '@langchain/openai';
import { TasksService } from '@/lucy/tools/tasks.service';

type Skill = {
  name: string;
  description: string;
  tool: OpenAIClient.ChatCompletionTool;
};

export enum Tools {
  GET_TASKS = 'get_tasks',
}

@Injectable()
export class ToolsService {
  constructor(private readonly taskService: TasksService) {}

  readonly skills: Skill[] = [
    {
      name: Tools.GET_TASKS,
      description: 'Get a list of tasks',
      tool: {
        type: 'function',
        function: {
          name: Tools.GET_TASKS,
          description: 'Get a list of tasks from todoist',
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
    },
  ];

  private readonly tools: OpenAIClient.ChatCompletionTool[] = this.skills.map(
    (skill) => skill.tool,
  );

  getActiveTools(agent: Agent): OpenAIClient.ChatCompletionTool[] | undefined {
    const skillsIds = agent.skills.map((skill) => skill.skillId) || [];
    const activeTools = this.tools.filter((tool) =>
      skillsIds.includes(tool.function.name),
    );

    if (activeTools.length === 0) {
      return undefined;
    }
    return activeTools;
  }

  // async processToolCalls(toolCalls: ToolCall[], agent: Agent) {
  //   const validatedToolCalls = await this.validate(toolCalls);
  //   messages.push(new AIMessage(response));

  //   const toolResults: {
  //     tool: {
  //       id: string;
  //       name: string;
  //     };
  //     toolResult: any;
  //   }[] = await this.useTool(validatedToolCalls);

  //   for (const toolResult of toolResults) {
  //     messages.push(
  //       new ToolMessage({
  //         content: JSON.stringify(toolResult.toolResult),
  //         tool_call_id: toolResult.tool.id,
  //         name: toolResult.tool.name,
  //       }),
  //     );
  //   }

  //   const { content } = await call(messages);
  //   modelResponse = content as string;
  // }

  async validate(toolCalls: ToolCall[]): Promise<ToolCall[]> {
    const validatedToolCalls: any[] = [];
    for (const toolCall of toolCalls) {
      const toolDefinition = this.tools.find(
        (tool) => tool.function.name === toolCall.name,
      );
      if (!toolDefinition) {
        console.error(`Tool definition not found for tool call`, toolCall);
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
          console.error(error);
        }

        // if its an enum check if value is in enum
        if (paramDef.enum) {
          if (!paramDef.enum.includes(value)) {
            const error = `Tool call validation failed for ${key}. Expected value to be in enum [${paramDef.enum}] but got ${value}`;
            errors.push(error);
            console.error(error);
          }
        }
      }

      if (errors.length > 0) {
        const fixedToolCall = await this.tryToFix({
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

  private async tryToFix({ toolDefinition, toolCall, errors }) {
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
    console.debug(` Fixed tool call: . ${JSON.stringify(fixedToolCall)}`);

    return fixedToolCall;
  }

  async useTool(tools: ToolCall[]) {
    const result: any[] = [];
    for (const tool of tools) {
      switch (tool.name) {
        case Tools.GET_TASKS: {
          try {
            const { due } = tool.args;
            const tasks = await this.taskService.getTasks(due);
            result.push({
              tool,
              toolResult: tasks,
            });
            break;
          } catch (error) {
            console.error('Error calling tool', tool.name, error);
            result.push({
              tool,
              toolResult: error,
            });
          }
          break;
        }
        default:
          console.error(`Tool ${tool.name} not found`);
      }
    }

    return result;
  }
}
