import { IEvent } from "@nestjs/cqrs";

export class AssistantResponseReceivedEvent implements IEvent {
  constructor(
    public readonly payload: {
      text: string;
      channel: string;
    },
  ) {}
}
