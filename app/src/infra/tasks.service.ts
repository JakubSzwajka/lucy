import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { env } from "../env";
import https from 'https';

@Injectable()
export class TasksService {

  @Cron(CronExpression.EVERY_5_MINUTES)
  handleCron() {
    if (env.BETTER_STACK_HEARTBEAT_URL) {
        https.get(env.BETTER_STACK_HEARTBEAT_URL, () => {
            console.debug('❤️ Heartbeat sent to BetterStack');
        });
    }
  }
}