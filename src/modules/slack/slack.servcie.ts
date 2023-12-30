import { Injectable } from "@nestjs/common";
import { WebClient } from "@slack/web-api";
import { env } from "../../env";

@Injectable()
export class SlackWebClient extends WebClient {
  constructor() {
    super(env.SLACK_BOT_TOKEN);
  }
}
