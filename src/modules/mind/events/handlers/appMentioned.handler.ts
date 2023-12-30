import { EventBus, EventsHandler } from "@nestjs/cqrs";
import { AppMentionedEvent } from "../../../slack/events/appMention.event";
import { MindService } from "../../mind.service";
import { AssistantResponseReceivedEvent } from "../assistantResponseReceived.event";

@EventsHandler(AppMentionedEvent)
export class AppMentionedHandler {
  constructor(private readonly mindService: MindService, private readonly eventBus: EventBus) {}

  async handle(event: AppMentionedEvent) {
    const response = await this.mindService.processMessage(event.payload.text);
    await this.eventBus.publish(new AssistantResponseReceivedEvent({
      text: response,
      channel: event.payload.channel,
    }));
  }
}
