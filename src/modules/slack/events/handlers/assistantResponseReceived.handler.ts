import { EventsHandler } from "@nestjs/cqrs";
import { AssistantResponseReceivedEvent } from "../../../mind/events/assistantResponseReceived.event";
import { SlackWebClient } from "../../slack.servcie";

@EventsHandler(AssistantResponseReceivedEvent)
export class AssistantResponseReceivedHandler {
  constructor(private readonly slackWebClient: SlackWebClient) {}

  async handle(event: AssistantResponseReceivedEvent) {
    await this.slackWebClient.chat.postMessage({
      text: event.payload.text,
      channel: event.payload.channel,
    });
  }
}
