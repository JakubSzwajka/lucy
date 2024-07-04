import { OpenAIClient } from "@langchain/openai";
import { Tools } from "./lucy.toolset";

type Skill = {
    name: string;
    description: string;
    tool: OpenAIClient.ChatCompletionTool;
}

export const skills: Skill[] = [
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
                            // enum: ['today', 'overdue'],
                            enum: ['today | overdue'],
                            description: 'Due date of the tasks.'
                        }
                    },
                    required: ['due']
                }
            }
        }
    }
]

export const tools: OpenAIClient.ChatCompletionTool[] = skills.map(skill => skill.tool);

