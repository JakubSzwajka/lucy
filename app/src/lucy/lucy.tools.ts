import { OpenAIClient } from "@langchain/openai";
import { Tools } from "./lucy.toolset";

type Skill = {
    id: string;
    name: string;
    description: string;
    tool: OpenAIClient.ChatCompletionTool;
}

export const skills: Skill[] = [
    {
        id: 'Todoist-Get-Tasks',
        name: Tools.GET_TASKS,
        description: 'Get a list of tasks',
        tool: {
            type: 'function',
            function: {
                name: Tools.GET_TASKS,
                description: 'Get a list of tasks',
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

