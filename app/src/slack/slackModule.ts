import { Module, OnModuleInit } from '@nestjs/common';
import { SlackBot } from './slackBot';
import { LucyModule } from '@/lucy/lucy/lucy.module';
import { ConversationModule } from './modules/conversationModule';

@Module({
  imports: [LucyModule],
  providers: [SlackBot, ConversationModule],
})
export class SlackModule implements OnModuleInit {
  constructor(private readonly slackBot: SlackBot) {}

  async onModuleInit() {
    await this.slackBot.setup();
  }
}
