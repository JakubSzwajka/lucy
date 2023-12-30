import { IEvent } from "@nestjs/cqrs";

export class AppMentionedEvent implements IEvent {
  constructor(
    public readonly payload: {
      text: string;
      channel: string;
    },
  ) {}
}
