import { BaseMessage } from '@langchain/core/messages';
import { User } from '../lucy/entities/user.entity';
import { Message } from '../lucy/entities/message.entity';

export class MessageReceivedEvent {
  constructor(
    public readonly payload: {
      user: User;
      conversation: BaseMessage[];
      message: Message;
    },
  ) {}
}
