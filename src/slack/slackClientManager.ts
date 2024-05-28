import { App as BoltApp } from '@slack/bolt';
import { env } from 'env';

const { SLACK_BOT_TOKEN, SLACK_APP_LEVEL_TOKEN } = env;

export class ClientManager extends BoltApp {
  private static _instance: ClientManager;

  public static get instance() {
    if (!this._instance) {
      this._instance = new ClientManager();
    }
    return this._instance;
  }

  public static async start() {
    await this.instance.start();
  }

  constructor() {
    super({
      token: SLACK_BOT_TOKEN,
      appToken: SLACK_APP_LEVEL_TOKEN,
      socketMode: true,
    });
  }
}
