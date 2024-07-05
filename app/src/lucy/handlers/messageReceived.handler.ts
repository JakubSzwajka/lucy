import { MessageReceivedEvent } from '@/lucy/events/messageReceived.event';
import { EventsHandler } from '@nestjs/cqrs';
import { MemoriesService } from '../services/memories.service';

@EventsHandler(MessageReceivedEvent)
export class MessageReceivedHandler {
  constructor(private readonly memoriesService: MemoriesService) {}
  handle(event: MessageReceivedEvent) {
    this.memoriesService.extractMemories(
      event.payload.conversation,
      event.payload.user,
    );
  }
}
