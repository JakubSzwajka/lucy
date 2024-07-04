import { TodoistApi } from '@doist/todoist-api-typescript';
import { Injectable } from '@nestjs/common';
import { env } from '@/lucy/env';

@Injectable()
export class TasksService {
  private readonly client = new TodoistApi(env.TODOIST_API_KEY);

  async getTasks(due: 'today' | 'tomorrow' | 'today | overdue') {
    return await this.client.getTasks({
      filter: due,
    });
  }
}
