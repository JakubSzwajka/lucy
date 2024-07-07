import { MessageReceivedEvent } from '@/lucy/events/messageReceived.event';
import { EventsHandler } from '@nestjs/cqrs';
import { MemoriesService } from '../services/memories.service';
import { Memory } from '../entities/memory.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@EventsHandler(MessageReceivedEvent)
export class MessageReceivedHandler {
  constructor(
    private readonly memoriesService: MemoriesService,
    @InjectRepository(Memory)
    private readonly memoryRepository: Repository<Memory>,
  ) {}
  async handle(event: MessageReceivedEvent) {
    let savedMemories = await this.memoryRepository.find({
      where: {
        user: event.payload.user,
      },
    });

    // console.log('\n SAVED #######', savedMemories);
    if (!savedMemories) {
      savedMemories = [];
    }

    const memories = await this.memoriesService.extractMemories({
      conversation: event.payload.conversation,
      memories: savedMemories,
    });
    // console.log('\n EXTRACTED #######', memories);

    const { memories: validatedMemories, update } =
      await this.memoriesService.validateMemories({
        memories: savedMemories,
        newMemories: memories,
      });

    // console.log('------------------------------------');
    // console.log('\n NEW #######', validatedMemories);
    // console.log('\n TO UPDATE #######', update);
    // console.log('------------------------------------');

    if (validatedMemories.length > 0) {
      await this.memoryRepository.save(
        validatedMemories.map((memory) => ({
          ...memory,
          user: event.payload.user,
          messages: [event.payload.message],
        })),
      );
    }

    if (update.length > 0) {
      for (const memory of update) {
        const oldMemory = await this.memoryRepository.findOne({
          where: { id: memory.id },
          relations: ['messages'],
        });
        if (oldMemory) {
          await this.memoryRepository.save({
            ...oldMemory,
            messages: [...oldMemory.messages, event.payload.message],
          });
        } else {
          console.error('Memory not found for update', memory);
        }
      }
    }
  }
}
