import { TodoistApi } from '@doist/todoist-api-typescript';
import { Injectable } from '@nestjs/common';
import { env } from 'src/env';

@Injectable()
export class TasksService {
  private readonly client = new TodoistApi(env.TODOIST_API_KEY);

  async getTasks(due: 'today' | 'tomorrow') {
    console.log('due: ', due);
    const tasks = await this.client.getTasks({
      filter: due,
    });

    console.log('tasks: ', tasks);
    return tasks;
  }
}
