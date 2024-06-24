import { Injectable } from '@nestjs/common';
import { BotModule } from './modules/botModule';
import { ClientManager } from './slackClientManager';
import { ConversationModule } from './modules/conversationModule';

@Injectable()
export class SlackBot {
  constructor(private readonly conversationModule: ConversationModule) {}

  private ClientManager = ClientManager;

  private BotModules: BotModule[] = [this.conversationModule];

  private setupModules() {
    return Promise.all(this.BotModules.map((module) => module.setup()));
  }

  public async setup() {
    await this.setupModules();
    await this.ClientManager.start();
  }

  private clearModules() {
    return Promise.all(this.BotModules.map((module) => module.clear()));
  }

  public async clear() {
    await this.clearModules();
    await this.ClientManager.instance.stop();
  }
}
