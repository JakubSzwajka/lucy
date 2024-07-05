import { BaseMessage } from '@langchain/core/messages';
import { User } from '../lucy/entities/user.entity';

export class MessageReceivedEvent {
  constructor(
    public readonly payload: {
      user: User;
      conversation: BaseMessage[];
    },
  ) {}
}
