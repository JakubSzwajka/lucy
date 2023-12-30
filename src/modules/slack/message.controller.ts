import { Body, Controller, Logger, Post, Request } from "@nestjs/common";
import { Public } from "../infra/decorators/public";
import { EventBus } from "@nestjs/cqrs";
import { AppMentionedEvent } from "./events/appMention.event";

enum SlackEventType {
  AppMention = "app_mention",
  Message = "message",
}

type SlackEvent = {
  event: {
    type: SlackEventType;
    text: string;
    user: string;
    ts: string;
    channel: string;
  };
  challenge?: string;
};

type SlackEventRequestHeaders = {
  "x-slack-retry-reason": string;
  "x-slack-retry-num": string;
};

@Controller()
export class SlackController {
  private readonly logger = new Logger(SlackController.name);
  constructor(private readonly eventBus: EventBus) {}

  @Public()
  @Post("event")
  async getSlackMessage(@Body() body: SlackEvent, @Request() req: { headers: SlackEventRequestHeaders }) {
    if (req.headers["x-slack-retry-reason"] !== undefined) {
      this.logger.warn("Slack retrying message, ignoring...");
      return;
    }

    if (body.challenge !== undefined) {
      return body.challenge;
    } else if (body.event.type === SlackEventType.AppMention) {
      this.eventBus.publish(
        new AppMentionedEvent({
          text: body.event.text,
          channel: body.event.channel,
        }),
      );
      return "OK";
    } else {
      return "OK";
    }
  }
}
