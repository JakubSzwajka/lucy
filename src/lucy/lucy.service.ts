import { Injectable } from '@nestjs/common';
import { call } from 'src/ai';
import { v4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Message, MessageSource } from './entities/message.entity';
import { Repository } from 'typeorm';

@Injectable()
export class LucyService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async talk(query: string): Promise<string> {
    const response = await call(query);
    try {
      const result = this.messageRepository.create(
        new Message({
          conversationId: v4(),
          human: query,
          agent: response,
          source: MessageSource.SLACK,
        }),
      );
      console.log('Message saved', result);
    } catch (error) {
      console.error('Error saving message', error);
    }
    return response;
  }
}
