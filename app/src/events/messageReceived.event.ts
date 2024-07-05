import { Message } from '../lucy/entities/message.entity';
import { User } from '../lucy/entities/user.entity';

export class MessageReceivedEvent {
  constructor(
    public readonly payload: {
      user: User;
      message: Message;
    },
  ) {}
}
