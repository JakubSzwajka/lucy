import { ToolCall } from '@langchain/core/dist/messages/tool';
import { Injectable } from '@nestjs/common';
import { TasksService } from '@/lucy/tools/tasks.service';

export enum Tools {
  GET_TASKS = 'get_tasks',
}

@Injectable()
export class LucyToolset {
  constructor(private readonly taskService: TasksService) {}

  async useTool(tools: ToolCall[]) {
    const result: any[] = [];
    for (const tool of tools) {
      switch (tool.name) {
        case Tools.GET_TASKS:
          const { due } = tool.args;
          const tasks = await this.taskService.getTasks(due);
          result.push({
            tool,
            toolResult: tasks,
          });
          break;
        default:
          console.error(`Tool ${tool.name} not found`);
      }
    }

    return result;
  }
}
