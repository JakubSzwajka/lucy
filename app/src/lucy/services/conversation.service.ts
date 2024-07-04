import { Injectable } from '@nestjs/common';
import { Raw, Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { InjectRepository } from '@nestjs/typeorm';

const CONVERSATIONS_IDS = {
  DEFAULT: 'default',
  NOTIFICATIONS: 'notifications',
};

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}
  private readonly MINUTES_OF_CONVERSATION_HISTORY = 10;

  async getHistory(conversationId: string): Promise<any> {
    // lets keep it clean for notifications. They mostly come from automations and they don't need history.
    let history: Message[] = [];
    if (conversationId === CONVERSATIONS_IDS.NOTIFICATIONS) {
      console.debug(`Skipping conversation history for notifications`);
    } else {
      history = await this.messageRepository.find({
        // last 10 minutes
        where: {
          createdAt: Raw((alias) => `${alias} > :date`, {
            date: new Date(
              Date.now() - 1000 * 60 * this.MINUTES_OF_CONVERSATION_HISTORY,
            ),
          }),
        },
        order: {
          createdAt: 'ASC',
        },
      });
    }
    return history;
  }
}
