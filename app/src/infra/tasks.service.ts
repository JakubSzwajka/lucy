import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { env } from "../env";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class TasksService {

  constructor(
    private readonly httpService: HttpService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {


    if (env.BETTER_STACK_HEARTBEAT_URL) {
      const response = await firstValueFrom(this.httpService.get(env.BETTER_STACK_HEARTBEAT_URL) )      
      if (response.status === 200) {
        console.log('❤️ Heartbeat sent to BetterStack');
      } else {
        console.error('❤️ Heartbeat failed to BetterStack');
      }
    }
  }
}