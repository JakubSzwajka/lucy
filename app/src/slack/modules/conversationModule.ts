import { Injectable } from '@nestjs/common';
import { BotModule } from './botModule';
import { LucyService } from '@/lucy/lucy/lucy.service';

@Injectable()
export class ConversationModule extends BotModule {
  key = 'conversation';

  constructor(private readonly lucy: LucyService) {
    super();
  }

  async setup() {
    await this.registerNewMessageEvent();
  }

  async clear() {
    //
  }

  private async registerNewMessageEvent() {
    this.ClientManager.instance.event('message', async ({ event, client }) => {
      if (event.type === 'message') {
        const eventPayload = event as { text: string };
        const response = await this.lucy.talk(eventPayload.text);
        await client.chat.postMessage({
          channel: event.channel,
          text: response,
        });
      }
    });
  }
}
