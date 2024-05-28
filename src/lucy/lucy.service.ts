import { Injectable } from '@nestjs/common';
import { call } from 'src/ai';
import { Message } from './brain.service';
import { v4 } from 'uuid';

@Injectable()
export class LucyService {
  async talk(message: string): Promise<string> {
    const assistantResponse = await call(message);
    const conversationId = v4();
    try {
      const result = await Message.query().insert({
        conversation_id: conversationId,
        human: message,
        assistant: assistantResponse,
      });
      console.log('Message saved', result);
    } catch (error) {
      console.error('Error saving message', error);
    }
    return assistantResponse;
  }
}
