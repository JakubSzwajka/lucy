import { Injectable } from '@nestjs/common';
import { call } from 'src/ai';
import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Message, MessageSource } from './entities/message.entity';
import { Repository, Raw } from 'typeorm';

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  private readonly MINUTES_OF_CONVERSATION_HISTORY = 10;

  async talk(query: string): Promise<string> {
    const history = await this.messageRepository.find({
      // last 10 minutes
      where: {
        createdAt: Raw((alias) => `${alias} > :date`, {
          date: new Date(
            Date.now() - 1000 * 60 * this.MINUTES_OF_CONVERSATION_HISTORY,
          ),
        }),
      },
    });
    const response = await call(query, history);
    try {
      const message = this.messageRepository.create(
        new Message({
          conversationId: v4(),
          human: query,
          agent: response,
          source: MessageSource.SLACK,
        }),
      );
      await this.messageRepository.save(message);
    } catch (error) {
      console.error('Error saving message', error);
    }
    return response;
  }
}
